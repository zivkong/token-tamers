#!/usr/bin/env bash
# GitHub Actions must be pinned to full commit SHAs — mutable tags (@v4, @main)
# are a known supply-chain compromise vector. A 40-hex pin with a trailing
# "# vX.Y.Z" comment is the required form.
set -euo pipefail
cd "$(dirname "$0")/.."

FAIL=0
while IFS= read -r line; do
  ref=$(echo "$line" | sed -E 's/.*uses:[[:space:]]*[^@]+@([^[:space:]#]+).*/\1/')
  if ! echo "$ref" | grep -qE '^[0-9a-f]{40}$'; then
    echo "FAIL: unpinned action ref: $line" >&2
    FAIL=1
  fi
done < <(grep -RhnE '^\s*-?\s*uses:\s' .github/workflows/ | grep -v 'uses:\s*\./')
[ "$FAIL" -eq 0 ] && echo "OK: all workflow actions pinned to commit SHAs."
exit "$FAIL"
