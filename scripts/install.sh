#!/bin/sh
# Token Tamers installer — fetch the right standalone `tt` binary for this
# machine, verify its checksum, and drop it on your PATH. No Node required.
#
#   curl -fsSL https://github.com/zivkong/token-tamers/releases/latest/download/install.sh | sh
#
# Honors two environment variables:
#   TT_VERSION       release tag to install (default: latest), e.g. TT_VERSION=v1.2.0
#   TT_INSTALL_DIR   directory to install into (default: ~/.local/bin)
#
# The installer itself only touches the network to GET release assets from
# github.com — the `tt` program it installs never does (design pillar: fully
# offline, read-only observer).
set -eu

REPO="zivkong/token-tamers"
REPO_URL="https://github.com/${REPO}"
BIN_NAME="tt"

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
die()   { printf '%s\n' "${RED}✗${RESET} $*" >&2; exit 1; }

# --- detect platform -------------------------------------------------------
detect_target() {
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Darwin) os="macos" ;;
    Linux)  os="linux" ;;
    *)
      die "Unsupported OS: $os. On Windows, download tt-windows-x64.exe from ${REPO_URL}/releases/latest"
      ;;
  esac
  case "$arch" in
    x86_64 | amd64)  arch="x64" ;;
    arm64 | aarch64) arch="arm64" ;;
    *) die "Unsupported architecture: $arch" ;;
  esac
  printf '%s-%s' "$os" "$arch"
}

# --- download helper (curl or wget) ----------------------------------------
download() {
  _url="$1"; _out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$_out" "$_url"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$_out" "$_url"
  else
    die "Need either curl or wget to download release assets."
  fi
}

# --- checksum (sha256sum or shasum) ----------------------------------------
sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    printf ''  # no tool available
  fi
}

main() {
  target="$(detect_target)"
  asset="${BIN_NAME}-${target}"

  tag="${TT_VERSION:-latest}"
  if [ "$tag" = "latest" ]; then
    base="${REPO_URL}/releases/latest/download"
    pretty_tag="latest"
  else
    base="${REPO_URL}/releases/download/${tag}"
    pretty_tag="$tag"
  fi

  printf '%s\n' "${BOLD}Token Tamers${RESET} installer — ${asset} (${pretty_tag})"

  tmp="$(mktemp -d 2>/dev/null || mktemp -d -t tokentamers)"
  trap 'rm -rf "$tmp"' EXIT INT TERM

  # Fetch the binary and the checksum manifest.
  info "Downloading ${asset}…"
  download "${base}/${asset}" "${tmp}/${asset}" \
    || die "Could not download ${base}/${asset} — does a release exist for '${pretty_tag}'?"

  info "Verifying checksum…"
  download "${base}/SHA256SUMS.txt" "${tmp}/SHA256SUMS.txt" \
    || die "Could not download SHA256SUMS.txt — refusing to install unverified binary."

  expected="$(awk -v a="$asset" '$2 == a { print $1 }' "${tmp}/SHA256SUMS.txt")"
  [ -n "$expected" ] || die "No checksum for ${asset} in SHA256SUMS.txt."
  actual="$(sha256_of "${tmp}/${asset}")"
  if [ -z "$actual" ]; then
    warn "No sha256sum/shasum tool found — skipping checksum verification."
  elif [ "$actual" != "$expected" ]; then
    die "Checksum mismatch for ${asset}.
   expected: ${expected}
   actual:   ${actual}
Aborting — the download may be corrupt or tampered with."
  else
    ok "Checksum verified."
  fi

  # Optional provenance check when the GitHub CLI is available.
  if command -v gh >/dev/null 2>&1; then
    if gh attestation verify "${tmp}/${asset}" --repo "$REPO" >/dev/null 2>&1; then
      ok "Build provenance attested."
    else
      info "gh present but provenance not verified (skipping; not fatal)."
    fi
  fi

  chmod +x "${tmp}/${asset}"

  # --- choose install dir; use sudo only if the target isn't writable ------
  dir="${TT_INSTALL_DIR:-$HOME/.local/bin}"
  dest="${dir}/${BIN_NAME}"
  if mkdir -p "$dir" 2>/dev/null && [ -w "$dir" ]; then
    mv -f "${tmp}/${asset}" "$dest"
  else
    warn "Elevated permissions needed to write to ${dir}."
    sudo mkdir -p "$dir"
    sudo mv -f "${tmp}/${asset}" "$dest"
    sudo chmod +x "$dest"
  fi

  # macOS Gatekeeper: strip the quarantine flag from the unsigned binary.
  if [ "${target%-*}" = "macos" ]; then
    xattr -d com.apple.quarantine "$dest" 2>/dev/null \
      || sudo xattr -d com.apple.quarantine "$dest" 2>/dev/null \
      || true
  fi

  ok "Installed ${BOLD}${BIN_NAME}${RESET} → ${dest}"

  # --- PATH guidance --------------------------------------------------------
  case ":${PATH}:" in
    *":${dir}:"*) on_path=1 ;;
    *) on_path=0 ;;
  esac
  if [ "$on_path" -eq 0 ]; then
    rc="$HOME/.profile"
    case "${SHELL:-}" in
      */zsh)  rc="$HOME/.zshrc" ;;
      */bash) rc="$HOME/.bashrc" ;;
    esac
    warn "${dir} is not on your PATH. Add it with:"
    printf '\n    echo '\''export PATH="%s:$PATH"'\'' >> %s && source %s\n\n' "$dir" "$rc" "$rc"
  fi

  printf '\n%s\n' "${BOLD}Next:${RESET}"
  printf '  %s init   %s\n' "$BIN_NAME" "${DIM}# one-time wizard — detects your agents, learns your baseline${RESET}"
  printf '  %s        %s\n' "$BIN_NAME" "${DIM}# the shell — meet your egg 🥚 (q to quit)${RESET}"
}

main "$@"
