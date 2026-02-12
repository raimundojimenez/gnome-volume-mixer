import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {VolumeMixerAddFilterDialog} from './volumeMixerAddFilterDialog.js';

export const VolumeMixerPrefsPage = GObject.registerClass({
    GTypeName: 'VolumeMixerPrefsPage',
}, class VolumeMixerPrefsPage extends Adw.PreferencesPage {
    constructor(settings) {
        super();

        this.settings = settings;
        this.filterListData = this.settings.get_strv('filtered-apps');

        const generalGroup = new Adw.PreferencesGroup();
        this.add(generalGroup);

        const showDescRow = new Adw.ActionRow({title: 'Show Audio Stream Description'});
        generalGroup.add(showDescRow);

        const showDescToggle = new Gtk.Switch({
            active: this.settings.get_boolean('show-description'),
            valign: Gtk.Align.CENTER,
        });
        this.settings.bind(
            'show-description',
            showDescToggle,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        showDescRow.add_suffix(showDescToggle);
        showDescRow.activatable_widget = showDescToggle;

        const showIconRow = new Adw.ActionRow({title: 'Show Application Icon'});
        generalGroup.add(showIconRow);

        const showIconToggle = new Gtk.Switch({
            active: this.settings.get_boolean('show-icon'),
            valign: Gtk.Align.CENTER,
        });
        this.settings.bind(
            'show-icon',
            showIconToggle,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        showIconRow.add_suffix(showIconToggle);
        showIconRow.activatable_widget = showIconToggle;

        const filterGroup = new Adw.PreferencesGroup({
            title: 'Application Filtering',
            description: 'Hide applications from the volume mixer.',
        });
        this.add(filterGroup);

        const filterModeModel = new Gio.ListStore({item_type: FilterMode});
        filterModeModel.append(new FilterMode('Block', 'block'));
        filterModeModel.append(new FilterMode('Allow', 'allow'));

        const findCurrentFilterMode = () => {
            for (let i = 0; i < filterModeModel.get_n_items(); i++) {
                if (filterModeModel.get_item(i).value === this.settings.get_string('filter-mode'))
                    return i;
            }

            return 0;
        };

        const filterModeRow = new Adw.ComboRow({
            title: 'Filter Mode',
            model: filterModeModel,
            expression: new Gtk.PropertyExpression(FilterMode, null, 'name'),
            selected: findCurrentFilterMode(),
        });
        filterGroup.add(filterModeRow);

        filterModeRow.connect('notify::selected', () => {
            const selected = filterModeRow.get_selected_item();
            if (selected)
                this.settings.set_string('filter-mode', selected.value);
        });

        this.filteredAppsGroup = new Adw.PreferencesGroup();
        this.add(this.filteredAppsGroup);

        for (const filteredAppName of this.filterListData)
            this.filteredAppsGroup.add(this.buildFilterListRow(filteredAppName));

        this.createAddFilteredAppButtonRow();
    }

    createAddFilteredAppButtonRow() {
        this.addFilteredAppButtonRow = new Adw.ActionRow();
        const addIcon = Gtk.Image.new_from_icon_name('list-add');
        addIcon.height_request = 40;
        this.addFilteredAppButtonRow.set_child(addIcon);
        this.filteredAppsGroup.add(this.addFilteredAppButtonRow);
        this.addFilteredAppButtonRow.activatable_widget = addIcon;
        this.addFilteredAppButtonRow.connect('activated', callingWidget => {
            this.showFilteredAppDialog(callingWidget, this.filterListData);
        });
    }

    buildFilterListRow(filteredAppName) {
        const filterListRow = new Adw.PreferencesRow({
            title: filteredAppName,
            activatable: false,
        });

        const filterListBox = new Gtk.Box({
            margin_bottom: 6,
            margin_top: 6,
            margin_end: 15,
            margin_start: 15,
        });

        const filterListLabel = Gtk.Label.new(filterListRow.title);
        filterListLabel.hexpand = true;
        filterListLabel.halign = Gtk.Align.START;
        filterListBox.append(filterListLabel);

        const filterListButton = new Gtk.Button({
            halign: Gtk.Align.END,
        });

        const filterListImage = Gtk.Image.new_from_icon_name('user-trash-symbolic');
        filterListButton.set_child(filterListImage);
        filterListButton.connect('clicked', () => this.removeFilteredApp(filteredAppName, filterListRow));

        filterListBox.append(filterListButton);
        filterListRow.set_child(filterListBox);

        return filterListRow;
    }

    removeFilteredApp(filteredAppName, filterListRow) {
        const index = this.filterListData.indexOf(filteredAppName);
        if (index < 0)
            return;

        this.filterListData.splice(index, 1);
        this.settings.set_strv('filtered-apps', this.filterListData);
        this.filteredAppsGroup.remove(filterListRow);
    }

    addFilteredApp(filteredAppName) {
        this.filterListData.push(filteredAppName);
        this.settings.set_strv('filtered-apps', this.filterListData);
        this.filteredAppsGroup.remove(this.addFilteredAppButtonRow);
        this.filteredAppsGroup.add(this.buildFilterListRow(filteredAppName));
        this.filteredAppsGroup.add(this.addFilteredAppButtonRow);
    }

    showFilteredAppDialog(callingWidget, filterListData) {
        const dialog = new VolumeMixerAddFilterDialog(callingWidget, filterListData);
        dialog.connect('response', (_dialog, response) => {
            if (response === Gtk.ResponseType.OK)
                this.addFilteredApp(dialog.appNameEntry.text);

            dialog.close();
            dialog.destroy();
        });
        dialog.present();
    }
});

const FilterMode = GObject.registerClass({
    Properties: {
        name: GObject.ParamSpec.string(
            'name', 'name', 'name',
            GObject.ParamFlags.READWRITE,
            null
        ),
        value: GObject.ParamSpec.string(
            'value', 'value', 'value',
            GObject.ParamFlags.READWRITE,
            null
        ),
    },
}, class FilterMode extends GObject.Object {
    _init(name, value) {
        super._init({name, value});
    }
});
