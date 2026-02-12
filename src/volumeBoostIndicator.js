import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import {QuickToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

const VolumeBoostToggle = GObject.registerClass(
class VolumeBoostToggle extends QuickToggle {
    _init(ownerUuid) {
        super._init({
            title: 'Volume Boost',
            iconName: 'audio-volume-high-symbolic',
            toggleMode: true,
        });
        this._volumeMixerOwnerUuid = ownerUuid;

        this._soundSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.sound',
        });

        this._soundSettings.bind(
            'allow-volume-above-100-percent',
            this,
            'checked',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});

export const VolumeBoostIndicator = GObject.registerClass(
class VolumeBoostIndicator extends SystemIndicator {
    _init(ownerUuid) {
        super._init();
        this._volumeMixerOwnerUuid = ownerUuid;

        this._toggle = new VolumeBoostToggle(ownerUuid);
        this.quickSettingsItems.push(this._toggle);
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});
