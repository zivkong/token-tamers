#!/usr/bin/env bash
# Stamp the release version into package.json from a git tag.
#
# Called from .github/workflows/release.yml (tag push `v*`) BEFORE `pnpm build`,
# so the bumped version is inlined into the bundle: the game reads it via
# apps/cli/src/version.ts -> root package.json (the single source of truth) and
# surfaces it on the Settings page / `tt --version`.
#
# Usage: set-version-from-tag.sh <tag>   (e.g. v1.2.3)
# The tag is untrusted input (anyone who can push a tag) — it is validated as a
# strict semver before it is ever written, never eval'd.
set -euo pipefail
cd "$(dirname "$0")/.."

TAG="${1:?usage: set-version-from-tag.sh <tag>}"
# Accept either a bare tag (GITHUB_REF_NAME) or a full ref, then drop the `v`.
VERSION="${TAG#refs/tags/}"
VERSION="${VERSION#v}"

# SemVer 2.0.0: MAJOR.MINOR.PATCH with optional -prerelease and +build.
SEMVER='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'
if ! printf '%s' "$VERSION" | grep -Eq "$SEMVER"; then
  echo "::error::Tag '$TAG' is not a valid semantic version (expected vX.Y.Z)" >&2
  exit 1
fi

echo "Setting package version to $VERSION"
# Root is the source of truth the game reads; apps/cli is the published binary
# package — keep them in lockstep. Edit via node to preserve JSON formatting.
for pkg in package.json apps/cli/package.json; do
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const version = process.argv[2];
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    pkg.version = version;
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  ' "$pkg" "$VERSION"
  echo "  $pkg -> $VERSION"
done
