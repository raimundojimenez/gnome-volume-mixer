import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Slider} from 'resource:///org/gnome/shell/ui/slider.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';

const UNMUTE_DEFAULT_VOLUME = 0.25;

export class DeviceStreamSlider {
    constructor(deviceType, opts = {}) {
        this._deviceType = deviceType; // 'output' or 'input'
        this._control = Volume.getMixerControl();
        this._getVolumeMax = typeof opts.getVolumeMax === 'function'
            ? opts.getVolumeMax
            : () => this._control?.get_vol_max_norm?.() ?? 1;
        this._stream = null;
        this._streamMutedChangedId = null;
        this._streamVolumeChangedId = null;
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

        this._label = new St.Label({
            text: this._noDeviceText(),
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        this._label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        headerRow.add_child(this._label);

        this._slider = new Slider(0);
        this._slider.x_expand = true;
        column.add_child(this._slider);

        this._sliderChangedId = this._slider.connect('notify::value',
            () => this._sliderChanged());

        this._refreshIcon();
    }

    setStream(stream) {
        if (this._stream === stream)
            return;

        this._disconnectStream();
        this._stream = stream;

        if (this._stream) {
            this._streamMutedChangedId = this._stream.connect('notify::is-muted',
                () => this._syncFromStream());
            this._streamVolumeChangedId = this._stream.connect('notify::volume',
                () => this._syncFromStream());

            const desc = this._stream.get_description?.() || '';
            this._label.text = desc || (this._deviceType === 'output' ? 'Output' : 'Input');
            this._slider.reactive = true;
            this._iconButton.reactive = true;
        } else {
            this._label.text = this._noDeviceText();
            this._slider.reactive = false;
            this._iconButton.reactive = false;
        }

        this._syncFromStream();
        this._refreshIcon();
    }

    _noDeviceText() {
        return this._deviceType === 'output' ? 'No output' : 'No input';
    }

    _streamIsMuted() {
        return this._stream?.is_muted ?? this._stream?.isMuted ?? false;
    }

    _currentMaxVolume() {
        const maxVolume = Number(this._getVolumeMax(this._stream, this._deviceType));
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
        if (!this._stream)
            return;

        const wasMuted = this._streamIsMuted();
        if (wasMuted && this._stream.volume === 0) {
            this._stream.volume = UNMUTE_DEFAULT_VOLUME * this._currentMaxVolume();
            this._stream.push_volume();
        }

        this._stream.change_is_muted(!wasMuted);
    }

    _sliderChanged() {
        if (!this._stream || this._syncing)
            return;

        const volume = this._slider.value * this._currentMaxVolume();
        if (volume < 1) {
            this._stream.volume = 0;
            this._stream.change_is_muted(true);
        } else {
            this._stream.volume = volume;
            this._stream.change_is_muted(false);
        }

        this._stream.push_volume();
        this._refreshIcon();
    }

    _syncFromStream() {
        if (!this._stream) {
            this._syncing = true;
            this._slider.value = 0;
            this._syncing = false;
            return;
        }

        this._syncing = true;
        this._slider.value = this._streamIsMuted()
            ? 0
            : this._normalizedVolume(this._stream.volume);
        this._syncing = false;
        this._refreshIcon();
    }

    _refreshIcon() {
        if (!this._stream) {
            this._icon.icon_name = this._deviceType === 'output'
                ? 'audio-volume-muted-symbolic'
                : 'audio-input-microphone-muted-symbolic';
            return;
        }

        const muted = this._streamIsMuted();
        const volume = this._stream.volume;
        const maxVolume = this._currentMaxVolume();

        if (this._deviceType === 'input') {
            this._icon.icon_name = muted || volume <= 0
                ? 'audio-input-microphone-muted-symbolic'
                : 'audio-input-microphone-symbolic';
            return;
        }

        // Output volume icons
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

    refreshVolumeScale() {
        this._syncFromStream();
    }

    _disconnectStream() {
        if (this._stream && this._streamMutedChangedId) {
            this._stream.disconnect(this._streamMutedChangedId);
            this._streamMutedChangedId = null;
        }

        if (this._stream && this._streamVolumeChangedId) {
            this._stream.disconnect(this._streamVolumeChangedId);
            this._streamVolumeChangedId = null;
        }
    }

    destroy() {
        this._disconnectStream();
        this._stream = null;
        this.item.destroy();
    }
}
