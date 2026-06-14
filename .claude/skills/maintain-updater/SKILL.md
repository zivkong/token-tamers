---
name: maintain-updater
description: Rules for the opt-in auto-updater — the ONE sanctioned network surface in an otherwise fully-offline app. Use when touching anything under apps/cli/src/services/updater, the update command/settings, or the network/isolation gates.
---

# Maintain the updater (apps/cli/src/services/updater)

Source of truth: `docs/design/auto-update.md`. The whole app is offline (pillar 7); the
updater is the single deliberate exception, engineered so the pledge stays true by default.

## Non-negotiables (CI-enforced)

- **One network file, forever.** `node:https`/`fetch`/any network module may appear ONLY in
  `apps/cli/src/services/updater/net.ts`. Two gates enforce it — `check-zero-network.sh`
  (no network outside that file) and `check-updater-isolation.sh` (that file is the ONLY one
  with network code, and it IS live). `eslint.config.js` allowlists `node:https` there alone.
  Need a new network call? Add it to `net.ts` behind `getJson`/`getBuffer`; never elsewhere.
- **Off by default.** `settings.update.mode` defaults to `off` → zero network. Never flip the
  default, never check/download without the user being in `notify`/`auto` or running
  `tt update`. The mode is settable three ways, all defaulting to `off` and applying on next
  launch: hand-editing `settings.json`, the `tt init` Preferences prompt, and the Settings-page
  `Updates ‹ off ›` toggle (off ▸ notify ▸ auto). Those control surfaces only WRITE the mode
  string — they must never import the updater network surface (the isolation gate still holds).
- **Outbound-read-only, zero telemetry.** GET only, to GitHub Releases. Never send a body,
  query params, or any usage/pet/identifying data. The updater tells GitHub nothing.
- **Verify before applying.** A binary is only swapped after its SHA-256 matches the
  release's `SHA256SUMS.txt` (`apply.ts`). On mismatch: abort, never touch the live binary.
- **Fail-silent + non-blocking.** Checks never throw to the caller or delay the shell.

## Shape

- `net.ts` = the surface (keep it dumb). `types.ts` = the injected `UpdateClient` + release
  shapes. `version.ts`/`assets.ts`/`verify.ts` = pure. `apply.ts` = download+verify+atomic
  swap. `index.ts` = `checkForUpdate`/`runUpdate`. `services/update-check.ts` = launch glue;
  `commands/update.ts` = `tt update`; `stores/updates.ts` = the once/day throttle.
- Asset names mirror `.github/workflows/release.yml`; the checksum asset is `SHA256SUMS.txt`.

## Testing

Everything but `net.ts` is pure/fs and unit-tested with an **injected fake client**, so the
suite stays offline and deterministic — never make a real network call in a test. Cover:
version compare, the asset matrix, install-kind, sha256 + mismatch-abort, and that
`mode: off`/throttled makes NO check. `net.ts` itself is integration-only (don't unit-test
real HTTP). See `apps/cli/__tests__/updater.test.ts`.
