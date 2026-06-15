# GNOME 50 Compatibility Notes (June 15, 2026)

## Scope
This note documents what was required to run the extension on GNOME Shell 50, after the system upgraded from
GNOME 49 to **GNOME Shell 50.2**.

## Problem Found
- `gnome-extensions info volume-mixer@raimundojimenez.es` reported **`State: OUT OF DATE`** and **`Enabled: No`**.
- Root cause was metadata, not code: `metadata.json` declared `shell-version: ["45","46","47","48","49"]`.
  GNOME refuses to load any extension whose `shell-version` does not list the running shell version, so the
  extension's code never executed (no journal errors — it never started).

## Investigation
- Official porting guide: <https://gjs.guide/extensions/upgrading/gnome-shell-50.html>.
  **No breaking changes** affect this extension. GNOME 50 changes to `ui/status/volume.js` and `ui/slider.js`
  are additive (`Slider.addMark()`/`clearMarks()`, `OutputIndicator._updatePrivacyIndicator()`) or unrelated
  (X11/restart removal, `keyboardManager` `holdKeyboard()/releaseKeyboard()` removal, `privacy-indicator`
  style classname removed).
- The Quick Settings volume output menu structure (`_volumeOutput…menu`) is unchanged. `extension.js`
  `_getVolumeMenu()` already probes 11+ API paths with a dynamic Quick Settings scan fallback, so it keeps
  working even if a property name shifts.
- The in-progress boost/panel work uses only stable APIs (`QuickToggle`, `SystemIndicator`,
  `PopupSwitchMenuItem`, `Gio.Settings`, `Gvc.MixerControl.get_vol_max_amplified`).

## Changes Taken
1. `metadata.json`: `shell-version` → `["45","46","47","48","49","50"]`; `version` 2 → 3. This alone clears the
   OUT-OF-DATE state and lets the extension load on GNOME 50.
2. Fixed a latent volume-persistence scale bug surfaced while reviewing the boost work:
   `_persistStreamState()` normalized saved volume against the normalized 100% reference
   (`get_vol_max_norm()`), but `_applySavedStateToStream()` restored against
   `_getApplicationVolumeMax()` — the amplified (~1.5×) scale when boost was active. A saved 150% therefore
   restored as 1.5 × 1.5 = 225%. Both sides now use `_getNormalizedMaxVolume()`, making persistence
   boost-independent and `restore(save(v)) == v`.

## Verification
- `npm run install` (build → `gnome-extensions install --force` → `restorecon` → disable/enable).
- `gnome-extensions info volume-mixer@raimundojimenez.es` → `Version: 3`, enabled, no longer OUT OF DATE.
- Journal shows `v3 enabled (build: …)`, `MixerControl state at init`, `_updateStreams: N total streams`,
  and no exception or "Unable to attach volume mixer menu section" warning.

> GJS caches ESModules for the lifetime of the GNOME Shell process. `metadata.json` (including `shell-version`)
> is re-read on enable, so the OUT-OF-DATE state clears immediately; but if the modules were already loaded in
> the session, new runtime behavior may require logout/login. Since the extension was OUT OF DATE (never loaded)
> this session, the first enable runs the new code.
