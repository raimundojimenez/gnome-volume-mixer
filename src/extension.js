import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {VolumeMixerPopupMenu} from './volumeMixerPopupMenu.js';

const MENU_ATTACH_RETRY_MS = 200;
const MENU_ATTACH_RETRY_COUNT = 25;

export default class VolumeMixerExtension extends Extension {
    enable() {
        this._menuAttachSourceId = null;
        this._menuAttachRetries = 0;
        this._volumeMixer = new VolumeMixerPopupMenu(this.getSettings());

        if (!this._attachMenuSection()) {
            this._menuAttachSourceId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                MENU_ATTACH_RETRY_MS,
                () => {
                    if (this._attachMenuSection()) {
                        this._menuAttachSourceId = null;
                        return GLib.SOURCE_REMOVE;
                    }

                    this._menuAttachRetries++;
                    if (this._menuAttachRetries >= MENU_ATTACH_RETRY_COUNT) {
                        this._menuAttachSourceId = null;
                        console.warn(`[${this.metadata.uuid}] Unable to attach volume mixer menu section`);
                        return GLib.SOURCE_REMOVE;
                    }

                    return GLib.SOURCE_CONTINUE;
                }
            );
        }
    }

    disable() {
        if (this._menuAttachSourceId !== null) {
            GLib.Source.remove(this._menuAttachSourceId);
            this._menuAttachSourceId = null;
        }

        if (this._volumeMixer !== null) {
            this._volumeMixer.destroy();
            this._volumeMixer = null;
        }
    }

    _attachMenuSection() {
        const volumeMenu = this._getVolumeMenu();
        if (!volumeMenu || !this._volumeMixer)
            return false;

        volumeMenu.addMenuItem(this._volumeMixer);
        return true;
    }

    _getVolumeMenu() {
        const quickSettingsVolumeMenu =
            Main.panel?.statusArea?.quickSettings?._volumeOutput?.item?.menu;
        if (quickSettingsVolumeMenu)
            return quickSettingsVolumeMenu;

        // GNOME <= 42 fallback.
        return Main.panel?.statusArea?.aggregateMenu?._volume?.menu ?? null;
    }
}
