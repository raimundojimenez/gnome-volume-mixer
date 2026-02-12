import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Slider} from 'resource:///org/gnome/shell/ui/slider.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';

const UNMUTE_DEFAULT_VOLUME = 0.25;

export class DeviceStreamSlider {
    constructor(deviceType) {
        this._deviceType = deviceType; // 'output' or 'input'
        this._control = Volume.getMixerControl();
        this._stream = null;
        this._streamMutedChangedId = null;
        this._streamVolumeChangedId = null;
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

        this._label = new St.Label({
            text: this._noDeviceText(),
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._label.set_style('min-width: 120px;');
        row.add_child(this._label);

        this._slider = new Slider(0);
        this._sliderBin = new St.Bin({
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            child: this._slider,
        });
        row.add_child(this._sliderBin);

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

    _toggleMute() {
        if (!this._stream)
            return;

        const wasMuted = this._streamIsMuted();
        if (wasMuted && this._stream.volume === 0) {
            this._stream.volume = UNMUTE_DEFAULT_VOLUME * this._control.get_vol_max_norm();
            this._stream.push_volume();
        }

        this._stream.change_is_muted(!wasMuted);
    }

    _sliderChanged() {
        if (!this._stream || this._syncing)
            return;

        const volume = this._slider.value * this._control.get_vol_max_norm();
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
            : this._stream.volume / this._control.get_vol_max_norm();
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
        const maxVolume = this._control.get_vol_max_norm();

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
