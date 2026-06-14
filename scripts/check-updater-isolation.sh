#!/usr/bin/env bash
# Positive containment for the one network exception (design pillar 7): assert
# that network-capable code lives in EXACTLY one file —
# apps/cli/src/services/updater/net.ts — and nowhere else. This both catches a
# new file sneaking in network code AND proves the allowlisted surface is live
# (a stale allowlist with no network in net.ts also fails).
set -euo pipefail
cd "$(dirname "$0")/.."

ALLOW='apps/cli/src/services/updater/net.ts'
PATTERN="from ['\"](node:)?(http|https|net|tls|dgram|dns|http2)['\"]|require\(['\"](node:)?(http|https|net|tls|dgram|dns|http2)['\"]\)|\bfetch\s*\(|XMLHttpRequest|WebSocket"

# Source only — skip build outputs (dist/out) and deps.
EXCLUDES=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=out)
files=$(grep -RIlE --include='*.ts' --include='*.js' "${EXCLUDES[@]}" "$PATTERN" packages apps || true)

if [ "$files" != "$ALLOW" ]; then
  echo "FAIL: network code must be isolated to exactly ${ALLOW}." >&2
  echo "      Files with network-capable code:" >&2
  echo "${files:-(none)}" | sed 's/^/        /' >&2
  exit 1
fi
echo "OK: network code is isolated to the updater surface (${ALLOW})."
