import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Slider} from 'resource:///org/gnome/shell/ui/slider.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';

const UNMUTE_DEFAULT_VOLUME = 0.25;

export class ApplicationStreamSlider {
    constructor(stream, opts) {
        this.stream = stream;
        this._control = Volume.getMixerControl();
        this._showIcon = opts.showIcon;
        this._onStateChanged = opts.onStateChanged ?? null;
        this._syncing = false;

        this.item = new PopupMenu.PopupBaseMenuItem({
            activate: false,
            can_focus: false,
        });

        const row = new St.BoxLayout({
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.item.add_child(row);

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
        row.add_child(this._iconButton);

        const name = stream.get_name();
        const description = stream.get_description();
        if (name || description) {
            this._label = new St.Label({
                text: name && opts.showDesc ? `${name} - ${description}` : (name || description),
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: false,
            });
            this._label.set_width(150);
            this._label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            row.add_child(this._label);
        }

        this._slider = new Slider(0);
        this._sliderBin = new St.Bin({
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            child: this._slider,
        });
        row.add_child(this._sliderBin);

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

    _toggleMute() {
        if (!this.stream)
            return;

        const wasMuted = this._streamIsMuted();
        if (wasMuted && this.stream.volume === 0) {
            this.stream.volume = UNMUTE_DEFAULT_VOLUME * this._control.get_vol_max_norm();
            this.stream.push_volume();
        }

        this.stream.change_is_muted(!wasMuted);
        this._notifyStateChanged();
    }

    _sliderChanged() {
        if (!this.stream || this._syncing)
            return;

        const volume = this._slider.value * this._control.get_vol_max_norm();
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
            : this.stream.volume / this._control.get_vol_max_norm();
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
        const maxVolume = this._control.get_vol_max_norm();
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
