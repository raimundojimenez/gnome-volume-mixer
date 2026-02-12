import St from 'gi://St';

import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';

export class ApplicationStreamSlider extends Volume.StreamSlider {
    constructor(stream, opts) {
        super(Volume.getMixerControl());

        this.stream = stream;

        if (opts.showIcon) {
            this._icon.icon_name = stream.get_icon_name();
        }

        let name = stream.get_name();
        let description = stream.get_description();

        if (name || description) {
            this._vbox = new St.BoxLayout({
                vertical: true,
            });

            this._label = new St.Label({
                text: name && opts.showDesc ? `${name} - ${description}` : (name || description),
            });
            this._vbox.add_child(this._label);

            this.item.remove_child(this._slider);
            this._vbox.add_child(this._slider);
            this._slider.set_height(32);

            this.item.add_child(this._vbox);
        }
    }
}
