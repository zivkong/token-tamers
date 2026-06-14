#!/usr/bin/env bash
# Token Tamers is fully offline (design pillar 7). Fail the build if any source
# file references a network-capable Node module or fetch() — EXCEPT the single
# sanctioned updater surface (apps/cli/src/services/updater/net.ts), the opt-in,
# off-by-default, outbound-read-only auto-updater. check-updater-isolation.sh
# proves that file is the ONLY one with network code.
set -euo pipefail
cd "$(dirname "$0")/.."

ALLOW='apps/cli/src/services/updater/net.ts'
PATTERN="from ['\"](node:)?(http|https|net|tls|dgram|dns|http2)['\"]|require\(['\"](node:)?(http|https|net|tls|dgram|dns|http2)['\"]\)|\bfetch\s*\(|XMLHttpRequest|WebSocket"

# Source only — skip build outputs (dist/out) and deps. Any network match OUTSIDE
# the allowlisted updater surface is a failure.
EXCLUDES=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=out)
if grep -RInE --include='*.ts' --include='*.js' "${EXCLUDES[@]}" "$PATTERN" packages apps | grep -v "^${ALLOW}:"; then
  echo "FAIL: network-capable code found outside the sanctioned updater surface." >&2
  echo "      The game never touches the network; only ${ALLOW} may." >&2
  exit 1
fi
echo "OK: zero network code (outside the opt-in updater surface)."
