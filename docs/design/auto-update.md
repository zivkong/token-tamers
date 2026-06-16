# Auto-update (the one sanctioned network surface)

Token Tamers is **fully offline** (pillar 7) and the game never touches the network.
Auto-update is the **single, deliberate exception** — and it is engineered so the pledge
stays true for everyone who doesn't opt in.

## Principles

1. **The game never touches the network.** All network code lives in exactly one file —
   `apps/cli/src/services/updater/net.ts` — and nothing else may import a network module.
   Two gates enforce this: `scripts/check-zero-network.sh` (fails on network code anywhere
   but that file) and `scripts/check-updater-isolation.sh` (asserts that file is the ONLY
   one with network code). `eslint.config.js` allows `node:https` in that file alone.
2. **Off by default.** `settings.json` → `update.mode` defaults to **`off`**: zero network
   calls, ever. Existing/most users are exactly as offline as before. Opting in is explicit.
3. **Outbound-read-only, zero telemetry.** Only HTTPS GETs to GitHub Releases. No request
   body, no query parameters, no usage / pet / DNA / identifying data is EVER sent. The
   updater fetches version metadata and signed binary assets; it tells GitHub nothing.
4. **Consent + transparency.** `tt update` is user-initiated (typing it is consent).
   `notify`/`auto` are opt-in. The UI always shows what's happening.
5. **Integrity.** Every downloaded asset is verified against the release's published
   `SHA256SUMS.txt`; a mismatch aborts and never touches the live binary. HTTPS only, TLS
   validation on, hosts allowlisted (`api.github.com`, `github.com`, the asset CDN),
   redirects bounded, requests time out.
6. **Non-blocking + fail-silent.** The launch-time check is async/best-effort; it never
   delays or crashes the shell, and any failure (offline, locked file) is swallowed.

## Modes (`settings.json` → `update.mode`)

| mode     | behavior                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------- |
| `off`    | default — no network, ever.                                                                        |
| `notify` | check GitHub ~once/day; surface the update notice (Pet-page ticker + Settings hint). No downloads. |
| `auto`   | `notify` + self-replace the standalone binary (verified) on next launch.                           |

`tt update` works on demand regardless of mode (explicit user action).

**Setting the mode.** `update.mode` is a hand-editable `settings.json` field, and is also
surfaced as an explicit opt-in control in two places, both defaulting to `off`:

- **`tt init`** — the Preferences step asks once ("Updates — off keeps the game fully offline.
  (o)ff (n)otify (a)uto"); the empty / `--yes` answer keeps the current value, so non-interactive
  runs never silently enable it.
- **Settings page** — an editable `Updates ‹ off ›` field (the first editable field, with the
  cycle-clock fields below it and the read-only adapter list further down); ←→ cycles
  `off ▸ notify ▸ auto`. The shell persists the change to `settings.json`; like the cycle edit it
  applies on the next launch. The TUI only writes the mode string — it never imports the updater
  network surface (the isolation gate still holds).

**Surfacing the hint.** Once the throttled launch check has seen a newer release
(`updates.json` → `latestSeen`), the shell surfaces it on the **Pet page** as a scrolling amber
ticker along the top of the scene (`components/marquee.ts`, driven by the frame counter so it stays
golden-test-safe) — the primary, can't-miss notice. The wording adapts to the mode: `auto` says
"restart tt to apply" (the binary self-replaced in the background), `notify` says "run 'tt update'
to upgrade".
The Settings page keeps the compact `· vX available` hint beside the `Updates` field as a secondary
cue. Both read the persisted `latestSeen` (no network), so the hint appears on the **launch after**
a check finds an update — never mid-session. The ticker only renders when an update is pending, so
the default (offline, up-to-date) Pet page is unchanged.

## Architecture (`apps/cli/src/services/updater/`)

- **`net.ts`** — THE network surface. `getJson`/`getBuffer` over `node:https`. Dumb on
  purpose; keep app logic out of it.
- **`types.ts`** — the injected `UpdateClient` seam + release shapes. Tests pass a fake
  client, so the whole suite runs offline and deterministic.
- **`version.ts`** — pure semver compare. **`assets.ts`** — pure install-kind detection
  (`binary` | `node` | `tsx`) + platform→asset name (mirrors `release.yml`).
  **`verify.ts`** — `node:crypto` SHA-256 + `SHA256SUMS` parsing.
- **`apply.ts`** — download → verify → atomic `rename` over `process.execPath`. Never
  writes unless the checksum matches.
- **`index.ts`** — `checkForUpdate` / `runUpdate` orchestration (fail-silent).

State: `~/.tokentamers/updates.json` (`lastCheckAt`, `latestSeen`) throttles the launch
check to ~once/day. `tt update` and the launch glue (`services/update-check.ts`) are the
only callers.

## Install kinds

- **Standalone pkg binaries** (`tt-macos-*`, `tt-linux-*`) self-replace in place.
- **`node tt.js` / dev / Windows binaries** are **notify-only** — they print the release
  page to update from (replacing a script-run install, or a running `.exe`, is fragile).

## Trust model

Source of truth is `github.com/zivkong/token-tamers` releases only. Integrity is the
published `SHA256SUMS.txt` (the release also publishes Sigstore build-provenance
attestations; verifying those is a future hardening — see below).

## Future / out of scope

Sigstore attestation verification, delta updates, Windows running-`.exe` replacement
beyond the notify fallback, and package-manager-native updates (brew / npm / winget).
