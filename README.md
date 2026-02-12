# Gnome Application Volume Mixer

<img src="https://extensions.gnome.org/extension-data/screenshots/screenshot_3499.png" height=250 align=right />

GNOME Shell extension that adds per-application volume sliders in the system audio menu.

## Project Status

This repository is a maintained fork of the original `mymindstorm/gnome-volume-mixer` project.

- The original project was no longer maintained.
- The original repository was archived by its author in December 2023.
- Because modern GNOME versions changed core extension APIs, this fork was rewritten to work on current GNOME releases.

## Why This Fork Exists

GNOME Shell changed extension architecture and panel internals after the original implementation:

- Legacy extension entrypoints were replaced by modern ESModule-based extension classes.
- Menu integration moved from legacy aggregate menu internals to Quick Settings.
- Metadata and packaging needed updates for current review and runtime expectations.

This fork keeps the same user-facing goal (per-app volume control) with a modernized codebase.

## Compatibility

- GNOME Shell: `45`, `46`, `47`, `48`, `49`
- Extension UUID (this fork): `volume-mixer@raimundojimenez.es`

### Install

This fork has a different UUID than the original extension and is distributed separately from the archived upstream listing.

## Build and Install Manually

```bash
npm ci
npm run build
gnome-extensions install --force dist/volume-mixer.zip
gnome-extensions enable volume-mixer@raimundojimenez.es
```

On Fedora systems with SELinux enforcing, relabel after install if the extension is not detected:

```bash
restorecon -RFv ~/.local/share/gnome-shell/extensions/volume-mixer@raimundojimenez.es
```

If the extension still does not appear, log out and log back in to reload GNOME Shell extension discovery.
