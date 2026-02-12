import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {VolumeMixerPopupMenu} from './volumeMixerPopupMenu.js';

const DEFAULT_PANEL_ICON = 'audio-x-generic-symbolic';

export class VolumeMixerPanelIndicator extends PanelMenu.Button {
    constructor(settings, openPreferencesCallback) {
        super(0.0, 'Application Volume Mixer', false);

        this._settings = settings;
        this._openPreferencesCallback = openPreferencesCallback;

        this._icon = new St.Icon({
            icon_name: DEFAULT_PANEL_ICON,
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        this._mixerSection = new VolumeMixerPopupMenu(this._settings);
        this.menu.addMenuItem(this._mixerSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const prefsItem = new PopupMenu.PopupMenuItem('Preferences');
        prefsItem.connect('activate', () => this._openPreferencesCallback?.());
        this.menu.addMenuItem(prefsItem);

        this._panelIconChangedId = this._settings.connect(
            'changed::panel-icon-name',
            () => this._refreshIcon()
        );
        this._refreshIcon();
    }

    _refreshIcon() {
        const configuredName = this._settings.get_string('panel-icon-name');
        this._icon.icon_name = configuredName || DEFAULT_PANEL_ICON;
    }

    destroy() {
        if (this._panelIconChangedId) {
            this._settings.disconnect(this._panelIconChangedId);
            this._panelIconChangedId = null;
        }

        super.destroy();
    }
}
