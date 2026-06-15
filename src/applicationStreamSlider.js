import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Slider} from 'resource:///org/gnome/shell/ui/slider.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';

const UNMUTE_DEFAULT_VOLUME = 0.25;

export class ApplicationStreamSlider {
    constructor(stream, opts = {}) {
        this.stream = stream;
        this._control = Volume.getMixerControl();
        this._showIcon = opts.showIcon;
        this._getVolumeMax = typeof opts.getVolumeMax === 'function'
            ? opts.getVolumeMax
            : () => this._control?.get_vol_max_norm?.() ?? 1;
        this._onStateChanged = opts.onStateChanged ?? null;
        this._syncing = false;

        this.item = new PopupMenu.PopupBaseMenuItem({
            activate: false,
            can_focus: false,
        });

        const column = new St.BoxLayout({
            vertical: true,
            x_expand: true,
        });
        this.item.add_child(column);

        const headerRow = new St.BoxLayout({
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        column.add_child(headerRow);

        this._icon = new St.Icon({
            style_class: 'popup-menu-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._refreshIcon();

        this._iconButton = new St.Button({
            child: this._icon,
            style_class: 'icon-button flat',
            can_focus: true,
            reactive: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._iconButton.connect('clicked', () => this._toggleMute());
        headerRow.add_child(this._iconButton);

        const name = stream.get_name();
        const description = stream.get_description();
        if (name || description) {
            this._label = new St.Label({
                text: name && opts.showDesc ? `${name} - ${description}` : (name || description),
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
            });
            this._label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            headerRow.add_child(this._label);
        }

        this._slider = new Slider(0);
        this._slider.x_expand = true;
        column.add_child(this._slider);

        this._sliderChangedId = this._slider.connect('notify::value',
            () => this._sliderChanged());
        this._streamMutedChangedId = this.stream.connect('notify::is-muted',
            () => this._syncFromStream());
        this._streamVolumeChangedId = this.stream.connect('notify::volume',
            () => this._syncFromStream());

        this._syncFromStream();
    }

    _streamIsMuted() {
        return this.stream?.is_muted ?? this.stream?.isMuted ?? false;
    }

    _currentMaxVolume() {
        const maxVolume = Number(this._getVolumeMax(this.stream));
        if (Number.isFinite(maxVolume) && maxVolume > 0)
            return maxVolume;

        const fallback = this._control?.get_vol_max_norm?.() ?? 1;
        return fallback > 0 ? fallback : 1;
    }

    _normalizedVolume(volume) {
        const maxVolume = this._currentMaxVolume();
        if (maxVolume <= 0)
            return 0;

        return Math.min(Math.max(volume / maxVolume, 0), 1);
    }

    _toggleMute() {
        if (!this.stream)
            return;

        const wasMuted = this._streamIsMuted();
        if (wasMuted && this.stream.volume === 0) {
            this.stream.volume = UNMUTE_DEFAULT_VOLUME * this._currentMaxVolume();
            this.stream.push_volume();
        }

        this.stream.change_is_muted(!wasMuted);
        this._notifyStateChanged();
    }

    _sliderChanged() {
        if (!this.stream || this._syncing)
            return;

        const volume = this._slider.value * this._currentMaxVolume();
        if (volume < 1) {
            this.stream.volume = 0;
            this.stream.change_is_muted(true);
        } else {
            this.stream.volume = volume;
            this.stream.change_is_muted(false);
        }

        this.stream.push_volume();
        this._refreshIcon();
        this._notifyStateChanged();
    }

    _syncFromStream() {
        if (!this.stream)
            return;

        this._syncing = true;
        this._slider.value = this._streamIsMuted()
            ? 0
            : this._normalizedVolume(this.stream.volume);
        this._syncing = false;
        this._refreshIcon();
    }

    _refreshIcon() {
        if (this._showIcon) {
            const streamIconName = this.stream.get_icon_name?.();
            if (streamIconName) {
                this._icon.icon_name = streamIconName;
                return;
            }
        }

        const muted = this._streamIsMuted();
        const volume = this.stream.volume;
        const maxVolume = this._currentMaxVolume();
        if (muted || volume <= 0) {
            this._icon.icon_name = 'audio-volume-muted-symbolic';
            return;
        }

        if (volume < maxVolume * 0.34) {
            this._icon.icon_name = 'audio-volume-low-symbolic';
            return;
        }

        if (volume < maxVolume * 0.67) {
            this._icon.icon_name = 'audio-volume-medium-symbolic';
            return;
        }

        this._icon.icon_name = 'audio-volume-high-symbolic';
    }

    _notifyStateChanged() {
        if (this._onStateChanged)
            this._onStateChanged(this.stream);
    }

    refreshVolumeScale() {
        this._syncFromStream();
    }

    destroy() {
        if (this.stream && this._streamMutedChangedId) {
            this.stream.disconnect(this._streamMutedChangedId);
            this._streamMutedChangedId = null;
        }

        if (this.stream && this._streamVolumeChangedId) {
            this.stream.disconnect(this._streamVolumeChangedId);
            this._streamVolumeChangedId = null;
        }

        this.item.destroy();
    }
}
