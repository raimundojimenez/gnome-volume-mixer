# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GNOME Shell extension that adds per-application volume sliders to the system audio Quick Settings menu. Maintained fork of the archived `mymindstorm/gnome-volume-mixer`, rewritten for modern GNOME Shell (45-50) ESModule-based extension APIs.

- **UUID:** `volume-mixer@raimundojimenez.es`
- **GSettings schema:** `es.raimundojimenez.volume-mixer`
- **Target:** GNOME Shell 45, 46, 47, 48, 49, 50

## Build & Development Commands

```bash
npm ci                  # Install build dependencies (first time)
npm run build           # Build extension zip to dist/
npm run install         # Build + install + SELinux fix + reload extension
npm run dev             # Build + install + tail GNOME Shell journal logs
npm run logs            # Tail journal logs only (no build/install)
```

The install pipeline: build → `gnome-extensions install --force` → `restorecon` (Fedora only) → disable/enable reload cycle.

**All code changes require logout/login.** GJS caches ESModules in the GNOME Shell process; `disable()`/`enable()` only re-runs the extension lifecycle with the same cached code. The `npm run install` pipeline still performs a disable/enable to validate the extension loads without errors, but the actual new code won't run until the next session. After reload, verify `_buildTime` in journal logs matches the expected build.

## Architecture

### Extension Lifecycle (extension.js)

`VolumeMixerExtension.enable()` initializes settings, creates the `VolumeMixerPopupMenu`, and attaches it to the Quick Settings volume menu. Because Quick Settings may not be ready immediately, attachment uses a retry loop (25 retries × 200ms). It also syncs the optional panel indicator and volume boost toggle based on GSettings.

`disable()` disconnects all signals, destroys all components, and performs stale indicator cleanup.

### Component Graph

```
extension.js (lifecycle)
├── volumeMixerPopupMenu.js  — PopupMenuSection that manages per-app sliders
│   └── applicationStreamSlider.js — Individual stream: icon + label row, slider row below
├── panelIndicator.js        — Optional top-bar PanelMenu.Button with extension icon
└── volumeBoostIndicator.js  — Optional QuickToggle for allow-volume-above-100-percent
```

Preferences (loaded by GNOME Extensions app, not by the shell extension):
```
prefs.js → volumeMixerPrefsPage.js → volumeMixerAddFilterDialog.js
```

### Key Patterns

- **Menu discovery:** `_getVolumeMenu()` tries 11+ API paths to find the volume output menu across GNOME versions, with a final dynamic scan of Quick Settings indicators as fallback.
- **Ownership tracking:** Indicators are tagged with `_volumeMixerOwnerUuid` so the extension can distinguish its own objects from stale orphans that survived a disable/enable cycle.
- **Volume persistence:** `VolumeMixerPopupMenu` saves per-app volume/mute state to `saved-app-volumes` GSettings key as `a{sv}` (dict of `(dbs)` tuples: volumeNorm, muted, updatedAt). Restored when streams reappear.
- **Variant unpacking:** `_unpackVariant()` tries `deep_unpack()`, `deepUnpack()`, and `recursiveUnpack()` to handle GLib.Variant API differences across GNOME versions.
- **Stream filtering:** Block/allow list in GSettings controls which app streams get sliders.
- **Slider layout:** Use vertical 2-row layout (header row with icon+label, then full-width slider) inside PopupBaseMenuItem. Never pack a Slider horizontally alongside a label — PopupMenu items have ~350-400px width and the slider needs most of it.

### Gvc Stream Types

`control.get_streams()` returns all stream types mixed together:

| GType | Represents | Example |
|-------|-----------|---------|
| `GvcMixerSink` | Output device | Speakers, HDMI |
| `GvcMixerSource` | Input device | Microphone |
| `GvcMixerSinkInput` | Per-app output stream | Firefox playing audio |
| `GvcMixerSourceOutput` | Per-app input stream | App using microphone |
| `GvcMixerEventRole` | System sound effects | Alert sounds |

Only `GvcMixerSinkInput` streams generate application sliders. A device with no apps playing audio correctly shows "No active application streams".

### GSettings Schema Keys

Defined in `schemas/es.raimundojimenez.volume-mixer.gschema.xml`:

| Key | Type | Purpose |
|-----|------|---------|
| `filtered-apps` | `as` | App names for block/allow filtering |
| `filter-mode` | `s` | `'block'` or `'allow'` |
| `show-description` | `b` | Show stream description in slider label |
| `show-icon` | `b` | Show app icon next to slider |
| `show-panel-icon` | `b` | Show top panel indicator |
| `panel-icon-name` | `s` | Icon name for panel indicator |
| `enable-boost-toggle` | `b` | Show volume boost QuickToggle |
| `saved-app-volumes` | `a{sv}` | Persisted volume/mute state per app |

Schema must be recompiled after changes: `glib-compile-schemas schemas`

## GNOME Shell API Dependencies

Extension runtime imports from `gi://` (GLib, Gio, GObject, St, Clutter, Gvc) and `resource:///org/gnome/shell/` (Extension, Main, PopupMenu, PanelMenu, QuickSettings, Volume, Slider).

Preferences imports from `gi://` (GLib, Gio, GObject, Gtk, Adw) and `resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js`.

## SELinux (Fedora/RHEL)

`gnome-extensions install` extracts through a cache path, giving files `cache_home_t` context. GNOME Shell cannot load extensions with wrong context. The install script auto-runs `restorecon -RFv` on Fedora; skipped on non-SELinux systems.

## Git Commits

Never include `Co-Authored-By` lines in commit messages.

## Debugging

Extension logs to GNOME Shell journal with `[volume-mixer@raimundojimenez.es]` prefix. Use `console.log()` / `console.warn()` in source. Runtime notes and past incident analysis in `docs/gnome49-runtime-notes-2026-02-12.md`; GNOME 50 compatibility, the Looking Glass reload technique, and lessons learned in `docs/gnome50-compat-2026-06-15.md`.

**Metadata-only changes** (e.g. bumping `shell-version`/`version`) are cached in-memory by the running shell — `disable`/`enable` and `gnome-extensions info` do **not** re-read `metadata.json` from disk. Force a fresh read without logout/login from Looking Glass (`Alt+F2` → `lg`):

```js
Main.extensionManager.reloadExtension(Main.extensionManager.lookup('volume-mixer@raimundojimenez.es'))
```

This also loads new code **only** if the extension wasn't already imported this session (e.g. it was OUT OF DATE). The DBus `ReloadExtension` method is dead on GNOME 50 (`NotSupported`), and `Eval` is gated behind `unsafe_mode`. For ordinary `*.js` edits to an already-loaded extension, the ESModule cache still requires logout/login.

On PipeWire, `MixerControl` reaches `READY` before all sink input streams are registered. The extension schedules a delayed re-check (2s) to catch late-arriving streams. Check rejection logs (`[volume-mixer] Rejected stream`) to verify stream type detection.
