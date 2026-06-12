#!/usr/bin/env bash
# Filename convention gate: every tracked path component is kebab-case
# (lowercase letters, digits, dots, hyphens; optional leading dot).
# Exceptions, each load-bearing:
#   - Conventional root files (README.md, LICENSE, SECURITY.md, CONTRIBUTING.md,
#     CLAUDE.md, CODEOWNERS) — universally expected names.
#   - SKILL.md — required by the Claude Code skill format.
#   - pull_request_template.md — name required by GitHub.
#   - __tests__ / __snapshots__ — test-framework conventions.
set -euo pipefail
cd "$(dirname "$0")/.."

EXCEPTIONS='^(README\.md|LICENSE|SECURITY\.md|CONTRIBUTING\.md|CLAUDE\.md|CODEOWNERS|SKILL\.md|pull_request_template\.md|__tests__|__snapshots__)$'
KEBAB='^\.?[a-z0-9][a-z0-9.-]*$'

FAIL=0
while IFS= read -r path; do
  IFS='/' read -ra parts <<< "$path"
  for part in "${parts[@]}"; do
    if [[ ! "$part" =~ $KEBAB ]] && [[ ! "$part" =~ $EXCEPTIONS ]]; then
      echo "FAIL: non-kebab-case path component '$part' in: $path" >&2
      FAIL=1
    fi
  done
done < <(git ls-files)
[ "$FAIL" -eq 0 ] && echo "OK: all tracked paths are kebab-case."
exit "$FAIL"
