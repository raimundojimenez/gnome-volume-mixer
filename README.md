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

- GNOME Shell: `45`, `46`, `47`, `48`, `49`, `50`
- Extension UUID (this fork): `volume-mixer@raimundojimenez.es`

## Troubleshooting Notes

- Runtime incident notes (panel icon, boost toggle duplication, design decisions, follow-up actions): `docs/gnome49-runtime-notes-2026-02-12.md`
- GNOME Shell 50 compatibility notes (shell-version bump, boost persistence scale fix): `docs/gnome50-compat-2026-06-15.md`

### Install

This fork has a different UUID than the original extension and is distributed separately from the archived upstream listing.

## Build and Install

```bash
npm ci
npm run install
```

This runs the full pipeline: build, `gnome-extensions install --force`, SELinux `restorecon` (Fedora/RHEL — skipped automatically on other systems), and extension reload via disable/enable cycle.

For development with live GNOME Shell journal output:

```bash
npm run dev
```

### Available Scripts

| Script | Description |
|---|---|
| `npm run build` | Build extension zip to `dist/` |
| `npm run install` | Build + install + SELinux fix + reload |
| `npm run dev` | Install + tail GNOME Shell journal logs |
| `npm run logs` | Tail GNOME Shell journal (no install) |

> **Note:** Most changes take effect immediately after the disable/enable reload. Structural changes (new GObject types, new imports) may require a full logout/login.

### SELinux on Fedora

On Fedora, `gnome-extensions install` extracts the zip through a cache path, and the resulting files inherit the `cache_home_t` SELinux context instead of `data_home_t`. GNOME Shell cannot load extensions with the wrong context. The install script detects this and runs `restorecon -RFv` automatically. On non-SELinux systems (Ubuntu, Arch), this step is skipped.
