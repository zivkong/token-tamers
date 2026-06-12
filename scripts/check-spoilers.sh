#!/usr/bin/env bash
# Spoiler gate: fusion-locked special pet ids may live ONLY under
# packages/content/content/ — never in docs/, README, or the wiki.
# Pool contents are listed in packages/content/content/v*/fusion-pools.json
# (absent until M2); each "species" id found there is grepped against docs.
set -euo pipefail
cd "$(dirname "$0")/.."

shopt -s nullglob
POOLS=(packages/content/content/v*/fusion-pools.json)
if [ ${#POOLS[@]} -eq 0 ]; then
  echo "OK: no fusion pools shipped yet, nothing to spoil."
  exit 0
fi

FAIL=0
for pool in "${POOLS[@]}"; do
  ids=$(grep -oE '"species_id"\s*:\s*"[^"]+"' "$pool" | sed -E 's/.*"([^"]+)"$/\1/') || true
  for id in $ids; do
    if grep -RIni --include='*.md' "$id" docs README.md 2>/dev/null; then
      echo "FAIL: special-pool id '$id' appears in public docs." >&2
      FAIL=1
    fi
  done
done
[ "$FAIL" -eq 0 ] && echo "OK: no spoilers in docs."
exit "$FAIL"
