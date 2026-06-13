# Getting Started

## Install

See the [README](../../README.md#install) for per-OS install instructions
(standalone binaries on every GitHub Release; `tt.js` for Node ≥ 20 users).

## `tt init` — the only required interaction, ever

1. **Detection** — probes for installed agents (Claude Code: `~/.claude/projects/`).
2. **Plan type per provider:**
   - _Subscription with limit windows_ (Claude Pro/Max) → **dynamic cycle policy**:
     molt windows inferred from your real usage gaps.
   - _API / pay-as-you-go_ → **static cycle policy**: fixed 5-hour windows and a 7-day
     week anchored to a configurable epoch (default: next Monday 00:00 local).
3. **Backfill** — scans existing logs to establish your normalization baseline.
   Your first week hatches a **Calibration Egg**: it plays normally, but grades are
   provisional until a baseline exists.
4. **Egg hatch** — your egg fast-hatches **~10 minutes** after your first session
   closes (the only exception to the usual 5-hour molt window). You'll see your
   sprite in the shell right away — no waiting half a day.

Re-running `tt init` adds/removes adapters without touching pet state.

## Troubleshooting adapter detection

- `tt adapters` shows each adapter's detected paths, last scan, and warnings.
- Claude Code sessions older than ~30 days are auto-deleted by Claude Code itself —
  that's fine; Token Tamers persists what it has ingested into its own store
  (`~/.tokentamers/`).
