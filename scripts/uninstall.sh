#!/bin/sh
# Token Tamers uninstaller — remove the standalone `tt` binary this machine
# installed. By default your pet is left untouched; opt in to wipe it too.
#
#   curl -fsSL https://github.com/zivkong/token-tamers/releases/latest/download/uninstall.sh | sh
#
# Honors two environment variables:
#   TT_INSTALL_DIR   directory `tt` was installed into (default: ~/.local/bin)
#   TT_PURGE         set to 1 to ALSO delete ~/.tokentamers (your pet + config).
#                    This is permanent — every generation is gone. Default: keep it.
#
# This script only touches your local filesystem — it makes no network request.
set -eu

BIN_NAME="tt"
DATA_DIR="$HOME/.tokentamers"

# --- pretty output (only colorize a real terminal) -------------------------
if [ -t 1 ]; then
  BOLD="$(printf '\033[1m')"; DIM="$(printf '\033[2m')"
  GREEN="$(printf '\033[32m')"; YELLOW="$(printf '\033[33m')"
  RED="$(printf '\033[31m')"; RESET="$(printf '\033[0m')"
else
  BOLD=""; DIM=""; GREEN=""; YELLOW=""; RED=""; RESET=""
fi
info()  { printf '%s\n' "${DIM}›${RESET} $*"; }
ok()    { printf '%s\n' "${GREEN}✓${RESET} $*"; }
warn()  { printf '%s\n' "${YELLOW}!${RESET} $*" >&2; }

# --- remove a file, escalating to sudo only if the dir isn't writable ------
remove_file() {
  _path="$1"
  _dir="$(dirname "$_path")"
  if [ -w "$_dir" ]; then
    rm -f "$_path"
  else
    warn "Elevated permissions needed to remove ${_path}."
    sudo rm -f "$_path"
  fi
}

main() {
  printf '%s\n' "${BOLD}Token Tamers${RESET} uninstaller"

  # --- locate the binary: prefer the install dir, then fall back to PATH ---
  dir="${TT_INSTALL_DIR:-$HOME/.local/bin}"
  dest="${dir}/${BIN_NAME}"
  if [ ! -e "$dest" ]; then
    found="$(command -v "$BIN_NAME" 2>/dev/null || true)"
    if [ -n "$found" ]; then
      dest="$found"
    fi
  fi

  if [ -e "$dest" ]; then
    remove_file "$dest"
    ok "Removed ${BOLD}${BIN_NAME}${RESET} → ${dest}"
  else
    info "No ${BIN_NAME} binary found (checked ${dir} and your PATH) — nothing to remove."
  fi

  # --- pet data: kept by default, wiped only on explicit opt-in ------------
  if [ -d "$DATA_DIR" ]; then
    if [ "${TT_PURGE:-0}" = "1" ]; then
      rm -rf "$DATA_DIR"
      ok "Purged your pet and config → ${DATA_DIR}"
    else
      info "Left your pet and config in place → ${DATA_DIR}"
      printf '  %s\n' "${DIM}reinstall any time and your lineage resumes; to erase it run:${RESET}"
      printf '  %s\n' "    rm -rf ${DATA_DIR}"
    fi
  fi

  printf '\n%s\n' "${DIM}Thanks for raising one. Your egg understands. 🥚${RESET}"
}

main "$@"
