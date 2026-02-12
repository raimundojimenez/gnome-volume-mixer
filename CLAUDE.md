# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GNOME Shell extension that adds per-application volume sliders to the system audio Quick Settings menu. Maintained fork of the archived `mymindstorm/gnome-volume-mixer`, rewritten for modern GNOME Shell (45-49) ESModule-based extension APIs.

- **UUID:** `volume-mixer@raimundojimenez.es`
- **GSettings schema:** `es.raimundojimenez.volume-mixer`
- **Target:** GNOME Shell 45, 46, 47, 48, 49

## Build & Development Commands

```bash
npm ci                  # Install build dependencies (first time)
npm run build           # Build extension zip to dist/
npm run install         # Build + install + SELinux fix + reload extension
npm run dev             # Build + install + tail GNOME Shell journal logs
npm run logs            # Tail journal logs only (no build/install)
```

The install pipeline: build → `gnome-extensions install --force` → `restorecon` (Fedora only) → disable/enable reload cycle.

Most changes take effect after the disable/enable reload. Structural changes (new GObject types, new imports) require logout/login.

## Architecture

### Extension Lifecycle (extension.js)

`VolumeMixerExtension.enable()` initializes settings, creates the `VolumeMixerPopupMenu`, and attaches it to the Quick Settings volume menu. Because Quick Settings may not be ready immediately, attachment uses a retry loop (25 retries × 200ms). It also syncs the optional panel indicator and volume boost toggle based on GSettings.

`disable()` disconnects all signals, destroys all components, and performs stale indicator cleanup.

### Component Graph

```
extension.js (lifecycle)
├── volumeMixerPopupMenu.js  — PopupMenuSection that manages per-app sliders
│   └── applicationStreamSlider.js — Individual stream: icon + label + slider
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

Extension logs to GNOME Shell journal with `[volume-mixer@raimundojimenez.es]` prefix. Use `console.log()` / `console.warn()` in source. Runtime notes and past incident analysis in `docs/gnome49-runtime-notes-2026-02-12.md`.
