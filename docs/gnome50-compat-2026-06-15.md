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

> GNOME Shell caches each extension's metadata **in memory** at session scan time. `gnome-extensions install
> --force` + `disable`/`enable` does **not** re-read `metadata.json`: after install the running shell still
> reported `Version: 2 / OUT OF DATE` even though the file on disk was `version: 3`. `gnome-extensions info`
> queries that cached in-memory state over DBus, not the disk. A fresh metadata read requires either
> logout/login or the Looking Glass reload below.

## Applying a metadata change without logout/login (Looking Glass)

GNOME 50 is **Wayland-only** (X11 was removed), so there is no in-place shell restart (`Alt+F2` → `r` is gone).
The DBus `org.gnome.Shell.Extensions.ReloadExtension` method is also dead — it now answers
`GDBus.Error:org.freedesktop.DBus.Error.NotSupported: ReloadExtension is deprecated and does not work`. And
`org.gnome.Shell.Eval` is gated behind `global.context.unsafe_mode` (off by default), so it can't be scripted
from the shell either.

However, the **JS method** the old Reload button used still exists on the live `ExtensionManager`. From
Looking Glass (`Alt+F2` → `lg` → *Evaluator*):

```js
Main.extensionManager.reloadExtension(Main.extensionManager.lookup('volume-mixer@raimundojimenez.es'))
```

`Main` is already a global in Looking Glass. The call returns a `Promise` (the method is `async` in GNOME 50);
the reload proceeds regardless. Its body (from `js/ui/extensionSystem.js`, `gnome-50`) does:

1. `unloadExtension(old)` — disables and drops the in-memory object.
2. `createExtensionObject(uuid, dir, type)` — calls `loadExtensionMetadata()`, which **re-reads `metadata.json`
   from disk** (so it picks up `version: 3` and `shell-version: ["…","50"]`).
3. `loadExtension(new)` — `_isOutOfDate()` now returns false (`"50".startsWith("50")`), so it inits and (because
   the UUID is in the enabled list) enables the extension.

This worked here as a **complete** reload — not just metadata — because the extension had never been imported
this session (it was OUT_OF_DATE, so its ESModules were never loaded). With no cached module, step 3's dynamic
`import()` loaded the new code fresh.

**Caveat — this is not a general code-reload.** Once an extension's ESModules have been imported, GJS caches
them for the lifetime of the gnome-shell process. `reloadExtension` will then re-read metadata and re-run the
lifecycle, but it will **not** pick up edited `*.js` code. For ordinary code changes you still need logout/login.

## Lessons Learned

1. `shell-version` is metadata, not code. A missing entry makes GNOME mark the extension OUT OF DATE and refuse
   to load it — so there are **no journal errors to find** (the code never ran). Check
   `gnome-extensions info <uuid>` for `OUT OF DATE` first.
2. The running shell caches extension metadata in memory. `disable`/`enable` (and `gnome-extensions info`) do
   not re-read `metadata.json` from disk; only logout/login or `reloadExtension` does.
3. `ReloadExtension` over DBus is deprecated and throws on GNOME 50, but
   `Main.extensionManager.reloadExtension()` in Looking Glass is the live equivalent and re-reads metadata.
4. Reloading truly refreshes code **only** for an extension that wasn't already imported (e.g. it was
   OUT_OF_DATE). The ESModule cache otherwise pins old code until logout/login — see `CLAUDE.md`.
5. Keep save/restore math symmetric and state-independent: persisting volume against `get_vol_max_norm()` but
   restoring against the boost-amplified max double-applied the boost factor. Define the stored value relative
   to one fixed reference (the normalized 100%) on both sides.
