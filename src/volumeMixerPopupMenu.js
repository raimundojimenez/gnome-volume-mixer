import GLib from 'gi://GLib';
import Gvc from 'gi://Gvc';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';

import {ApplicationStreamSlider} from './applicationStreamSlider.js';
import {DeviceStreamSlider} from './deviceStreamSlider.js';

const EMPTY_STATE_TEXT = 'No active application streams';
const MAX_SAVED_VOLUME_NORM = 1.5;

export class VolumeMixerPopupMenu extends PopupMenu.PopupMenuSection {
    constructor(settings) {
        super();
        this.settings = settings;
        this._applicationStreams = {};
        this._settingsChangedIds = [];
        this._savedVolumes = {};

        // The PopupSeparatorMenuItem needs something above and below it or it won't display
        this._hiddenItem = new PopupMenu.PopupBaseMenuItem();
        this._hiddenItem.set_height(0);
        this.addMenuItem(this._hiddenItem);

        // Device sliders (output + input) above the app streams section
        this._outputSlider = new DeviceStreamSlider('output');
        this.addMenuItem(this._outputSlider.item);

        this._inputSlider = new DeviceStreamSlider('input');
        this.addMenuItem(this._inputSlider.item);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._emptyItem = new PopupMenu.PopupMenuItem(EMPTY_STATE_TEXT, {
            reactive: false,
            can_focus: false,
        });
        this.addMenuItem(this._emptyItem);

        this._control = Volume.getMixerControl();
        if (!this._control) {
            console.warn('[volume-mixer] MixerControl not available');
            return;
        }

        this._streamAddedEventId = this._control.connect('stream-added', this._streamAdded.bind(this));
        this._streamRemovedEventId = this._control.connect('stream-removed', this._streamRemoved.bind(this));
        this._defaultSinkChangedId = this._control.connect('default-sink-changed',
            () => this._refreshOutputSlider());
        this._defaultSourceChangedId = this._control.connect('default-source-changed',
            () => this._refreshInputSlider());

        this._settingsChangedIds.push(
            this.settings.connect('changed::filtered-apps', () => this._updateStreams()),
            this.settings.connect('changed::filter-mode', () => this._updateStreams()),
            this.settings.connect('changed::show-description', () => this._updateStreams()),
            this.settings.connect('changed::show-icon', () => this._updateStreams()),
            this.settings.connect('changed::saved-app-volumes', () => this._loadSavedVolumes())
        );

        this._loadSavedVolumes();

        // MixerControl may still be connecting to PulseAudio/PipeWire;
        // get_streams() returns empty until state reaches READY
        const state = this._control.get_state?.() ?? null;
        if (state === Gvc.MixerControlState.READY) {
            this._refreshDeviceSliders();
            this._updateStreams();
        } else {
            this._stateChangedId = this._control.connect('state-changed',
                (_control, newState) => this._onStateChanged(newState));
        }
    }

    _streamAdded(control, id) {
        if (id in this._applicationStreams)
            return;

        const stream = control.lookup_stream_id(id);
        if (!stream || stream.is_event_stream || !(stream instanceof Gvc.MixerSinkInput))
            return;

        if (!this._shouldShowStream(stream))
            return;

        this._applySavedStateToStream(stream);

        this._applicationStreams[id] = new ApplicationStreamSlider(stream, {
            showDesc: this._showStreamDesc,
            showIcon: this._showStreamIcon,
            onStateChanged: updatedStream => this._persistStreamState(updatedStream),
        });
        this.addMenuItem(this._applicationStreams[id].item);
        this._syncEmptyState();
    }

    _streamRemoved(_control, id) {
        if (id in this._applicationStreams) {
            this._applicationStreams[id].destroy();
            delete this._applicationStreams[id];
        }

        this._syncEmptyState();
    }

    _shouldShowStream(stream) {
        if (this._filterMode === 'block')
            return this._filteredApps.indexOf(stream.get_name()) === -1;

        if (this._filterMode === 'allow')
            return this._filteredApps.indexOf(stream.get_name()) !== -1;

        return true;
    }

    _updateStreams() {
        for (const id in this._applicationStreams) {
            this._applicationStreams[id].destroy();
            delete this._applicationStreams[id];
        }

        this._filteredApps = this.settings.get_strv('filtered-apps');
        this._filterMode = this.settings.get_string('filter-mode');
        this._showStreamDesc = this.settings.get_boolean('show-description');
        this._showStreamIcon = this.settings.get_boolean('show-icon');

        for (const stream of this._control.get_streams()) {
            this._streamAdded(this._control, stream.get_id());
        }

        this._syncEmptyState();
    }

    _syncEmptyState() {
        this._emptyItem.visible = Object.keys(this._applicationStreams).length === 0;
    }

    _onStateChanged(newState) {
        if (newState === Gvc.MixerControlState.READY) {
            console.log('[volume-mixer] MixerControl reached READY state');
            this._disconnectStateChanged();
            this._refreshDeviceSliders();
            this._updateStreams();
        } else if (newState === Gvc.MixerControlState.FAILED) {
            console.warn('[volume-mixer] MixerControl failed to connect');
            this._disconnectStateChanged();
        }
    }

    _disconnectStateChanged() {
        if (this._stateChangedId) {
            this._control.disconnect(this._stateChangedId);
            this._stateChangedId = null;
        }
    }

    _refreshDeviceSliders() {
        this._refreshOutputSlider();
        this._refreshInputSlider();
    }

    _refreshOutputSlider() {
        const sink = this._control.get_default_sink?.() ?? null;
        this._outputSlider.setStream(sink);
    }

    _refreshInputSlider() {
        const source = this._control.get_default_source?.() ?? null;
        this._inputSlider.setStream(source);
    }

    _persistStreamState(stream) {
        const appKey = this._getStreamKey(stream);
        if (!appKey)
            return;

        const maxVolume = this._control.get_vol_max_norm();
        const volumeNorm = maxVolume > 0
            ? Math.min(Math.max(stream.volume / maxVolume, 0), MAX_SAVED_VOLUME_NORM)
            : 0;
        const muted = this._streamIsMuted(stream);

        const prev = this._savedVolumes[appKey];
        if (prev &&
            Math.abs(prev.volumeNorm - volumeNorm) < 0.001 &&
            prev.muted === muted) {
            return;
        }

        this._savedVolumes[appKey] = {
            volumeNorm,
            muted,
            updatedAt: new Date().toISOString(),
        };

        this._writeSavedVolumes();
    }

    _applySavedStateToStream(stream) {
        const appKey = this._getStreamKey(stream);
        if (!appKey)
            return;

        const savedState = this._savedVolumes[appKey];
        if (!savedState)
            return;

        const maxVolume = this._control.get_vol_max_norm();
        if (maxVolume <= 0)
            return;

        const targetVolume = Math.min(Math.max(savedState.volumeNorm, 0), MAX_SAVED_VOLUME_NORM) * maxVolume;
        stream.volume = targetVolume;
        stream.change_is_muted(Boolean(savedState.muted));
        stream.push_volume();
    }

    _getStreamKey(stream) {
        const streamName = stream.get_name?.();
        if (typeof streamName !== 'string')
            return null;

        const normalized = streamName.trim();
        return normalized.length > 0 ? normalized : null;
    }

    _streamIsMuted(stream) {
        return stream?.is_muted ?? stream?.isMuted ?? false;
    }

    _loadSavedVolumes() {
        const savedVolumes = {};
        try {
            const rawDict = this._unpackVariant(this.settings.get_value('saved-app-volumes'));
            if (!rawDict || typeof rawDict !== 'object' || Array.isArray(rawDict)) {
                this._savedVolumes = savedVolumes;
                return;
            }

            for (const [appName, entry] of Object.entries(rawDict)) {
                const unpacked = this._unpackVariant(entry);
                if (!Array.isArray(unpacked) || unpacked.length < 2)
                    continue;

                const volumeNorm = Number(unpacked[0]);
                const muted = Boolean(unpacked[1]);
                const updatedAt = typeof unpacked[2] === 'string' ? unpacked[2] : '';

                if (!Number.isFinite(volumeNorm))
                    continue;

                savedVolumes[appName] = {
                    volumeNorm: Math.min(Math.max(volumeNorm, 0), MAX_SAVED_VOLUME_NORM),
                    muted,
                    updatedAt,
                };
            }
        } catch (error) {
            console.warn(`Unable to read saved app volumes: ${error}`);
        }

        this._savedVolumes = savedVolumes;
    }

    _unpackVariant(value) {
        if (value?.deep_unpack)
            return value.deep_unpack();

        if (value?.deepUnpack)
            return value.deepUnpack();

        if (value?.recursiveUnpack)
            return value.recursiveUnpack();

        return value;
    }

    _writeSavedVolumes() {
        const packed = {};
        for (const [appName, state] of Object.entries(this._savedVolumes)) {
            packed[appName] = new GLib.Variant('(dbs)', [
                state.volumeNorm,
                state.muted,
                state.updatedAt ?? '',
            ]);
        }

        this.settings.set_value('saved-app-volumes', new GLib.Variant('a{sv}', packed));
    }

    destroy() {
        this._disconnectStateChanged();

        if (this._streamAddedEventId) {
            this._control.disconnect(this._streamAddedEventId);
            this._streamAddedEventId = null;
        }

        if (this._streamRemovedEventId) {
            this._control.disconnect(this._streamRemovedEventId);
            this._streamRemovedEventId = null;
        }

        if (this._defaultSinkChangedId) {
            this._control.disconnect(this._defaultSinkChangedId);
            this._defaultSinkChangedId = null;
        }

        if (this._defaultSourceChangedId) {
            this._control.disconnect(this._defaultSourceChangedId);
            this._defaultSourceChangedId = null;
        }

        for (const settingsChangedId of this._settingsChangedIds)
            this.settings.disconnect(settingsChangedId);
        this._settingsChangedIds = [];

        for (const id in this._applicationStreams)
            this._applicationStreams[id].destroy();
        this._applicationStreams = {};

        if (this._outputSlider) {
            this._outputSlider.destroy();
            this._outputSlider = null;
        }

        if (this._inputSlider) {
            this._inputSlider.destroy();
            this._inputSlider = null;
        }

        super.destroy();
    }
};
