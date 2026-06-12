#!/usr/bin/env bash
# Token Tamers is fully offline (design pillar 7). Fail the build if any source
# file references a network-capable Node module or fetch().
set -euo pipefail
cd "$(dirname "$0")/.."

PATTERN="from ['\"](node:)?(http|https|net|tls|dgram|dns|http2)['\"]|require\(['\"](node:)?(http|https|net|tls|dgram|dns|http2)['\"]\)|\bfetch\s*\(|XMLHttpRequest|WebSocket"

if grep -RInE --include='*.ts' --include='*.js' "$PATTERN" packages apps; then
  echo "FAIL: network-capable code found. Token Tamers never touches the network." >&2
  exit 1
fi
echo "OK: zero network code."
