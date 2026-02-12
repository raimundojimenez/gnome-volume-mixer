import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {VolumeMixerPanelIndicator} from './panelIndicator.js';
import {VolumeMixerPopupMenu} from './volumeMixerPopupMenu.js';
import {VolumeBoostIndicator} from './volumeBoostIndicator.js';

const MENU_ATTACH_RETRY_MS = 200;
const MENU_ATTACH_RETRY_COUNT = 25;
const PANEL_INDICATOR_ID = 'application-volume-mixer';

export default class VolumeMixerExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._menuAttachSourceId = null;
        this._menuAttachRetries = 0;
        this._menuAttached = false;
        this._volumeMixer = new VolumeMixerPopupMenu(this._settings);
        this._panelIndicator = null;
        this._boostIndicator = null;

        this._panelVisibilityChangedId = this._settings.connect(
            'changed::show-panel-icon',
            () => this._syncPanelIndicator()
        );
        this._boostVisibilityChangedId = this._settings.connect(
            'changed::enable-boost-toggle',
            () => this._syncBoostIndicator()
        );

        this._syncPanelIndicator();
        this._syncBoostIndicator();

        if (!this._attachMenuSection()) {
            this._menuAttachSourceId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                MENU_ATTACH_RETRY_MS,
                () => {
                    this._syncBoostIndicator();

                    if (this._attachMenuSection()) {
                        this._menuAttachSourceId = null;
                        return GLib.SOURCE_REMOVE;
                    }

                    this._menuAttachRetries++;
                    if (this._menuAttachRetries >= MENU_ATTACH_RETRY_COUNT) {
                        this._menuAttachSourceId = null;
                        console.warn(
                            `[${this.metadata.uuid}] Unable to attach volume mixer menu section. ` +
                            `Quick Settings keys: ${this._getQuickSettingsKeys().join(', ')}`
                        );
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

        if (this._panelVisibilityChangedId) {
            this._settings.disconnect(this._panelVisibilityChangedId);
            this._panelVisibilityChangedId = null;
        }

        if (this._boostVisibilityChangedId) {
            this._settings.disconnect(this._boostVisibilityChangedId);
            this._boostVisibilityChangedId = null;
        }

        this._destroyPanelIndicator();
        this._destroyBoostIndicator();

        if (this._volumeMixer !== null) {
            this._volumeMixer.destroy();
            this._volumeMixer = null;
        }

        this._settings = null;
        this._menuAttached = false;
    }

    _attachMenuSection() {
        if (this._menuAttached)
            return true;

        const volumeMenu = this._getVolumeMenu();
        if (!volumeMenu || !this._volumeMixer)
            return false;

        volumeMenu.addMenuItem(this._volumeMixer);
        this._menuAttached = true;
        return true;
    }

    _syncPanelIndicator() {
        const shouldShowPanelIcon = this._settings?.get_boolean('show-panel-icon');
        if (!shouldShowPanelIcon) {
            this._destroyPanelIndicator();
            return;
        }

        if (this._panelIndicator)
            return;

        this._panelIndicator = new VolumeMixerPanelIndicator(
            this._settings,
            () => this.openPreferences()
        );
        Main.panel.addToStatusArea(PANEL_INDICATOR_ID, this._panelIndicator, 1, 'right');
    }

    _destroyPanelIndicator() {
        if (!this._panelIndicator)
            return;

        this._panelIndicator.destroy();
        this._panelIndicator = null;
    }

    _syncBoostIndicator() {
        const shouldShowBoostToggle = this._settings?.get_boolean('enable-boost-toggle');
        if (!shouldShowBoostToggle) {
            this._destroyBoostIndicator();
            return true;
        }

        if (this._boostIndicator)
            return true;

        const quickSettings = Main.panel?.statusArea?.quickSettings;
        if (!quickSettings || typeof quickSettings.addExternalIndicator !== 'function')
            return false;

        this._boostIndicator = new VolumeBoostIndicator();
        quickSettings.addExternalIndicator(this._boostIndicator);
        return true;
    }

    _destroyBoostIndicator() {
        if (!this._boostIndicator)
            return;

        this._boostIndicator.destroy();
        this._boostIndicator = null;
    }

    _getVolumeMenu() {
        const quickSettings = Main.panel?.statusArea?.quickSettings;
        const quickSettingsMenuCandidates = [
            quickSettings?._volumeOutput?._output?.menu,
            quickSettings?._volumeOutput?.quickSettingsItems?.[0]?.menu,
            quickSettings?._volumeOutput?.item?.menu,
            quickSettings?._volumeOutput?.menu,
            quickSettings?._volume?.menu,
            quickSettings?._volume?.quickSettingsItems?.[0]?.menu,
            quickSettings?._volume?.item?.menu,
            quickSettings?._audio?.item?.menu,
            quickSettings?._audio?.menu,
            quickSettings?._volumeInputOutput?.item?.menu,
            quickSettings?._volumeInputOutput?.menu,
        ];

        for (const menu of quickSettingsMenuCandidates) {
            if (this._isPopupMenu(menu))
                return menu;
        }

        const discoveredMenu = this._findVolumeMenuInQuickSettingsItems(quickSettings);
        if (discoveredMenu)
            return discoveredMenu;

        // GNOME <= 42 fallback.
        return Main.panel?.statusArea?.aggregateMenu?._volume?.menu ?? null;
    }

    _findVolumeMenuInQuickSettingsItems(quickSettings) {
        const indicators = quickSettings?._indicators?.get_children?.() ?? [];
        for (const indicator of indicators) {
            const quickSettingsItems = indicator?.quickSettingsItems ?? [];

            for (const item of quickSettingsItems) {
                if (!this._isPopupMenu(item?.menu))
                    continue;

                const itemName = item.constructor?.name?.toLowerCase() ?? '';
                if (itemName.includes('volume') ||
                    itemName.includes('audio') ||
                    itemName.includes('output')) {
                    return item.menu;
                }

                const itemKeys = Object.keys(item);
                if (itemKeys.some(key =>
                    key.toLowerCase().includes('volume') ||
                    key.toLowerCase().includes('audio') ||
                    key.toLowerCase().includes('output'))) {
                    return item.menu;
                }
            }
        }

        return null;
    }

    _isPopupMenu(menu) {
        return menu &&
            typeof menu.addMenuItem === 'function';
    }

    _getQuickSettingsKeys() {
        const quickSettings = Main.panel?.statusArea?.quickSettings;
        if (!quickSettings)
            return [];

        try {
            return Reflect.ownKeys(quickSettings).map(key => key.toString());
        } catch (_error) {
            return [];
        }
    }
}
