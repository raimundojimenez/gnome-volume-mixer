import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {VolumeMixerPopupMenu} from './volumeMixerPopupMenu.js';

const DEFAULT_PANEL_ICON = 'audio-speakers-symbolic';
const EXTENSION_ICON = 'volume-mixer-symbolic';

export const VolumeMixerPanelIndicator = GObject.registerClass(
class VolumeMixerPanelIndicator extends PanelMenu.Button {
    _init(settings, openPreferencesCallback, extensionPath, ownerUuid, metadata) {
        super._init(0.0, 'Application Volume Mixer', false);

        this._settings = settings;
        this._openPreferencesCallback = openPreferencesCallback;
        this._extensionPath = extensionPath;
        this._volumeMixerOwnerUuid = ownerUuid;
        this._metadata = metadata;

        this._icon = new St.Icon({
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        this.menu.box.set_style('min-width: 300px;');

        this._mixerSection = new VolumeMixerPopupMenu(this._settings, {
            ownerUuid: ownerUuid,
            surface: 'panel-popup',
        });
        this.menu.addMenuItem(this._mixerSection);

        this._soundSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.sound',
        });
        this._syncingBoostSwitch = false;
        this._boostSwitch = new PopupMenu.PopupSwitchMenuItem(
            'Volume Boost',
            this._soundSettings.get_boolean('allow-volume-above-100-percent')
        );
        this._boostSwitchToggledId = this._boostSwitch.connect(
            'toggled',
            (_item, state) => this._onBoostSwitchToggled(state)
        );
        this._boostChangedId = this._soundSettings.connect(
            'changed::allow-volume-above-100-percent',
            () => this._syncBoostSwitchFromSettings()
        );
        this.menu.addMenuItem(this._boostSwitch);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const prefsItem = new PopupMenu.PopupMenuItem('Preferences');
        prefsItem.connect('activate', () => this._openPreferencesCallback?.());
        this.menu.addMenuItem(prefsItem);

        const v = this._metadata?.version ?? '?';
        const buildTime = this._metadata?._buildTime
            ? new Date(this._metadata._buildTime).toLocaleString()
            : 'dev';
        const versionItem = new PopupMenu.PopupMenuItem(`v${v} · ${buildTime}`, {
            reactive: false,
            can_focus: false,
        });
        versionItem.label.set_style('font-size: 0.85em; color: #888;');
        this.menu.addMenuItem(versionItem);

        this._panelIconChangedId = this._settings.connect(
            'changed::panel-icon-name',
            () => this._refreshIcon()
        );
        this._refreshIcon();
    }

    _onBoostSwitchToggled(state) {
        if (this._syncingBoostSwitch)
            return;

        this._soundSettings.set_boolean('allow-volume-above-100-percent', Boolean(state));
    }

    _syncBoostSwitchFromSettings() {
        if (!this._boostSwitch || !this._soundSettings)
            return;

        const nextState = this._soundSettings.get_boolean('allow-volume-above-100-percent');
        this._syncingBoostSwitch = true;
        if (typeof this._boostSwitch.setToggleState === 'function')
            this._boostSwitch.setToggleState(nextState);
        else
            this._boostSwitch.state = nextState;
        this._syncingBoostSwitch = false;
    }

    _refreshIcon() {
        const rawName = this._settings.get_string('panel-icon-name');
        let configuredName = typeof rawName === 'string' ? rawName.trim() : '';

        if (!configuredName)
            configuredName = DEFAULT_PANEL_ICON;

        // If user explicitly chose the bundled extension SVG, load from file
        if (configuredName === EXTENSION_ICON && this._setExtensionIcon())
            return;

        if (this._setIconFromPath(configuredName))
            return;

        // Standard theme icon (audio-speakers-symbolic, etc.)
        this._icon.gicon = null;
        this._icon.icon_name = configuredName;
    }

    _setExtensionIcon() {
        if (!this._extensionPath)
            return false;

        const iconPath = GLib.build_filenamev([
            this._extensionPath,
            'icons',
            `${EXTENSION_ICON}.svg`,
        ]);

        return this._setIconFromPath(iconPath);
    }

    _setIconFromPath(nameOrPath) {
        if (typeof nameOrPath !== 'string' || nameOrPath.length === 0)
            return false;

        const looksLikePath = nameOrPath.startsWith('/') || nameOrPath.includes('/') ||
            nameOrPath.endsWith('.svg') || nameOrPath.endsWith('.png');
        if (!looksLikePath)
            return false;

        if (!this._extensionPath && !nameOrPath.startsWith('/'))
            return false;

        const path = nameOrPath.startsWith('/')
            ? nameOrPath
            : GLib.build_filenamev([this._extensionPath, nameOrPath]);
        const file = Gio.File.new_for_path(path);
        if (!file.query_exists(null))
            return false;

        this._icon.icon_name = null;
        this._icon.gicon = new Gio.FileIcon({file});
        return true;
    }

    destroy() {
        if (this._boostSwitch && this._boostSwitchToggledId) {
            this._boostSwitch.disconnect(this._boostSwitchToggledId);
            this._boostSwitchToggledId = null;
        }

        if (this._soundSettings && this._boostChangedId) {
            this._soundSettings.disconnect(this._boostChangedId);
            this._boostChangedId = null;
        }
        this._soundSettings = null;

        if (this._panelIconChangedId) {
            this._settings.disconnect(this._panelIconChangedId);
            this._panelIconChangedId = null;
        }

        super.destroy();
    }
});
