#!/usr/bin/env bash
#
# Build, install, fix SELinux contexts, and reload the GNOME Shell extension.
# Usage: bash scripts/install.sh [--no-build] [--logs]

set -euo pipefail

UUID="volume-mixer@raimundojimenez.es"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
ZIP="dist/volume-mixer.zip"

# ── Color helpers (graceful fallback for non-TTY) ────────────────────────────
if [ -t 1 ]; then
    GREEN='\033[0;32m'  YELLOW='\033[1;33m'  RED='\033[0;31m'
    CYAN='\033[0;36m'   BOLD='\033[1m'       RESET='\033[0m'
else
    GREEN='' YELLOW='' RED='' CYAN='' BOLD='' RESET=''
fi

info()  { printf "${CYAN}▸${RESET} %s\n" "$*"; }
ok()    { printf "${GREEN}✓${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}⚠${RESET} %s\n" "$*"; }
err()   { printf "${RED}✗${RESET} %s\n" "$*" >&2; }

# ── Parse arguments ──────────────────────────────────────────────────────────
NO_BUILD=false
SHOW_LOGS=false

for arg in "$@"; do
    case "$arg" in
        --no-build) NO_BUILD=true ;;
        --logs)     SHOW_LOGS=true ;;
        *)          err "Unknown option: $arg"; exit 1 ;;
    esac
done

# ── 1. Build ─────────────────────────────────────────────────────────────────
if [ "$NO_BUILD" = true ]; then
    info "Skipping build (--no-build)"
    if [ ! -f "$ZIP" ]; then
        err "No existing zip found at $ZIP — run without --no-build first"
        exit 1
    fi
else
    info "Building extension…"
    npm run build
    ok "Build complete → $ZIP"
fi

# ── 2. Install ───────────────────────────────────────────────────────────────
info "Installing extension…"
gnome-extensions install --force "$ZIP"
ok "Installed to $EXT_DIR"

# ── 3. SELinux restorecon (Fedora / RHEL) ────────────────────────────────────
if command -v restorecon &>/dev/null; then
    info "Restoring SELinux contexts…"
    restorecon -RFv "$EXT_DIR"
    ok "SELinux contexts fixed (data_home_t)"
else
    info "restorecon not found — skipping SELinux relabel (not needed on this system)"
fi

# ── 4. Reload extension (disable → enable cycle) ────────────────────────────
info "Reloading extension…"
gnome-extensions disable "$UUID" 2>/dev/null || true
sleep 0.5
gnome-extensions enable "$UUID"
ok "Extension reloaded"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
ok "${BOLD}All done!${RESET} $UUID is active."
warn "Most changes take effect immediately. Structural changes (new GObject types, imports) may require logout/login."

# ── 5. Optional: tail journal logs ───────────────────────────────────────────
if [ "$SHOW_LOGS" = true ]; then
    echo ""
    info "Tailing GNOME Shell journal (Ctrl+C to stop)…"
    journalctl /usr/bin/gnome-shell --since "1 minute ago" -f -o cat
fi
