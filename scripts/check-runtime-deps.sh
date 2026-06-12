#!/usr/bin/env bash
# Zero-runtime-dependencies gate: every "dependencies" entry in every workspace
# package.json must be a workspace: link. Adding a real runtime dependency
# requires an approved issue AND updating this policy deliberately.
set -euo pipefail
cd "$(dirname "$0")/.."

FAIL=0
for pkg in package.json packages/*/package.json apps/*/package.json; do
  bad=$(node -e '
    const p = require(`./${process.argv[1]}`);
    const deps = p.dependencies || {};
    const bad = Object.entries(deps).filter(([, v]) => !String(v).startsWith("workspace:"));
    for (const [name, ver] of bad) console.log(`${name}@${ver}`);
  ' "$pkg")
  if [ -n "$bad" ]; then
    echo "FAIL: $pkg declares non-workspace runtime dependencies:" >&2
    echo "$bad" >&2
    FAIL=1
  fi
done
[ "$FAIL" -eq 0 ] && echo "OK: zero runtime dependencies (workspace links only)."
exit "$FAIL"
