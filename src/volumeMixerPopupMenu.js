import Gvc from 'gi://Gvc';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';

import {ApplicationStreamSlider} from './applicationStreamSlider.js';

export class VolumeMixerPopupMenu extends PopupMenu.PopupMenuSection {
    constructor(settings) {
        super();
        this.settings = settings;
        this._applicationStreams = {};

        // The PopupSeparatorMenuItem needs something above and below it or it won't display
        this._hiddenItem = new PopupMenu.PopupBaseMenuItem();
        this._hiddenItem.set_height(0);
        this.addMenuItem(this._hiddenItem);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._control = Volume.getMixerControl();
        this._streamAddedEventId = this._control.connect("stream-added", this._streamAdded.bind(this));
        this._streamRemovedEventId = this._control.connect("stream-removed", this._streamRemoved.bind(this));

        this._settingsChangedId = this.settings.connect('changed', () => this._updateStreams());

        this._updateStreams();
    }

    _streamAdded(control, id) {
        if (id in this._applicationStreams) {
            return;
        }

        const stream = control.lookup_stream_id(id);

        if (stream.is_event_stream || !(stream instanceof Gvc.MixerSinkInput)) {
            return;
        }

        if (this._filterMode === "block") {
            if (this._filteredApps.indexOf(stream.get_name()) !== -1) {
                return;
            }
        } else if (this._filterMode === "allow") {
            if (this._filteredApps.indexOf(stream.get_name()) === -1) {
                return;
            }
        }

        this._applicationStreams[id] = new ApplicationStreamSlider(stream, { showDesc: this._showStreamDesc, showIcon: this._showStreamIcon });
        this.addMenuItem(this._applicationStreams[id].item);
    }

    _streamRemoved(_control, id) {
        if (id in this._applicationStreams) {
            this._applicationStreams[id].item.destroy();
            delete this._applicationStreams[id];
        }
    }

    _updateStreams() {
        for (const id in this._applicationStreams) {
            this._applicationStreams[id].item.destroy();
            delete this._applicationStreams[id];
        }

        this._filteredApps = this.settings.get_strv("filtered-apps");
        this._filterMode = this.settings.get_string("filter-mode");
        this._showStreamDesc = this.settings.get_boolean("show-description");
        this._showStreamIcon = this.settings.get_boolean("show-icon");

        for (const stream of this._control.get_streams()) {
            this._streamAdded(this._control, stream.get_id());
        }
    }

    destroy() {
        this._control.disconnect(this._streamAddedEventId);
        this._control.disconnect(this._streamRemovedEventId);
        this.settings.disconnect(this._settingsChangedId);
        super.destroy();
    }
};
