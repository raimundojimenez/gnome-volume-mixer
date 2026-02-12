# GNOME 49 Runtime Notes (February 12, 2026)

## Scope
This note documents issues observed during the panel icon + volume boost work, the design decisions taken, and a fallback plan if symptoms return.

## Problems Found
1. Panel icon path was explicitly disabled in code.
   - `show-panel-icon` existed in settings/prefs but runtime always destroyed the indicator.
   - Result: users could not show the extension icon in the top bar even with the setting enabled.

2. `Volume Boost` toggle could appear duplicated.
   - Rapid toggle changes and extension reload cycles could leave stale `SystemIndicator` actors.
   - Result: one visible toggle remained after disabling, then a second one appeared after enabling again.

3. Extension icon expectations differed by surface.
   - Runtime panel icon is under extension control.
   - `extensions.gnome.org/local/` may still show fallback puzzle icon for unpublished UUIDs regardless of local metadata/icon assets.

4. Runtime verification friction in this environment.
   - `ReloadExtension` DBus method is unavailable in this GNOME session.
   - Full validation may require disable/enable or logout/login to clear cached shell module state.

## Lessons Learned
1. A settings switch is not enough; runtime path must be live and idempotent.
2. GNOME Quick Settings integrations need stale-instance cleanup in both enable/disable and setting transitions.
3. Own your indicator instances with explicit ownership tags (`uuid`) to prevent accidental deletion of third-party indicators.
4. Treat panel icon and EGO/local listing icon as different product surfaces with different guarantees.
5. For shell debugging, rely on fresh timestamped logs after reload attempts; one old warning line can come from stale runtime state.

## Design Decisions Taken
1. Re-enable panel indicator with guards, not unconditional attach.
   - Check panel availability and conflicting status-area IDs.
   - Wrap attach in `try/catch` and fail safely.

2. Make indicator lifecycle idempotent.
   - Add cleanup for stale panel indicator and orphan boost indicators.
   - Keep destroy paths safe to run multiple times.

3. Tag owned runtime objects.
   - `VolumeBoostIndicator` and toggle carry extension ownership markers.
   - Detection can distinguish "ours" vs unrelated indicators.

4. Add extension-owned symbolic icon asset.
   - Added `icons/volume-mixer-symbolic.svg`.
   - Updated metadata and build packaging so icon ships in ZIP.
   - Set schema default panel icon name to `volume-mixer-symbolic`.

5. Re-enable the panel icon preference UI.
   - Removed temporary "unavailable" behavior so prefs match runtime behavior again.

## If Problems Persist: Action Plan
1. Confirm loaded extension files and version.
   - Verify extension path and timestamps in `~/.local/share/gnome-shell/extensions/<uuid>`.
   - Confirm expected strings exist in installed `extension.js`.

2. Force a clean runtime cycle.
   - Disable/enable extension, then inspect logs since a fresh timestamp.
   - If behavior is still inconsistent, perform a full logout/login.

3. Capture targeted evidence.
   - Add temporary logs around:
     - panel indicator creation/destruction,
     - quick settings indicator list length before/after sync,
     - ownership markers found during cleanup.

4. Check for ID collisions.
   - Verify whether `application-volume-mixer` is already occupied by another extension actor.

5. Add stricter dedup if needed.
   - As a last resort, run a pre-attach sweep removing all owned boost indicators before creating a new one.

6. Validate across supported versions.
   - Smoke test on GNOME 45/46/47/48/49 (or at least 49 + one earlier release) because private Quick Settings internals vary.

## Operational Commands (reference)
```bash
# Build and install
npm run build
gnome-extensions install --force dist/volume-mixer.zip

# Reload (portable approach)
gnome-extensions disable volume-mixer@raimundojimenez.es
gnome-extensions enable volume-mixer@raimundojimenez.es

# Fresh logs
TS="$(date '+%Y-%m-%d %H:%M:%S')"
journalctl --user -b --since "$TS" --no-pager | rg -n "volume-mixer|JS ERROR|TypeError|ReferenceError|SyntaxError"
```
