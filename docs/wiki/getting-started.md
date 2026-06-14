# Getting Started

## Install

See the [README](../../README.md#install) for per-OS install instructions
(standalone binaries on every GitHub Release; `tt.js` for Node ≥ 20 users).

## `tt init` — the only required interaction, ever

1. **Detection** — probes for installed agents (Claude Code: `~/.config/claude/projects/`
   or `~/.claude/projects/`; OpenCode: `~/.local/share/opencode/`).
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

## Settings & version

Open `tt` and press **4** (or click **⚙ Settings**) to see what's in effect: the version
number, your runtime, the active color mode and fps, where your data lives
(`~/.tokentamers/`), and each configured adapter. Adapter **plan** (subscription/api) and
**cycle policy** (dynamic/static) are editable right there — press **↑↓** to focus a field
and **←→** to change it. Your choice is saved to `~/.tokentamers/config.json` and applies
the next time you launch `tt` (changing the cycle policy reshapes molt windows, so it
never shifts mid-session under your pet). Adding or removing an agent, or changing scan
paths, is still done by re-running `tt init`. You can also print the version
non-interactively with `tt --version`.

Token Tamers reads **no environment variables** — every preference lives in a file under
`~/.tokentamers/`. `settings.json` (hand-editable, created on demand) holds your `color`
choice (`auto` · `truecolor` · `256` · `8` · `none`; the `--no-color` flag always wins) and
`adapterRoots`, which override where an adapter scans if your agent stores logs somewhere
non-standard — e.g. `{"adapterRoots": {"claude-code": ["/custom/path"]}}`. The data
directory itself is always `~/.tokentamers`.

## Adding another agent later

Start with one agent and add more whenever you like — Token Tamers handles it
**forward-only**. The moment you enable a new agent (re-run `tt init`, or add it to
`config.json`), the game reads its past logs to **calibrate that agent's baseline**, so
its grade-roll odds are judged fairly against your own normal right away. But it never
rewrites your pet's history: your pet keeps growing from the point you add the agent
onward, and only usage from then feeds its molts, diet, and evolution. Your current pet
is left exactly as it was — nothing is re-rolled.

As always this is **read-only** (just reading local logs, never spending tokens or
quota), and which agent you run is **identity only** — it tints your pet's House and diet,
never how strong or rare it can become.

## Troubleshooting adapter detection

- When `tt init` can't find an agent at its default locations, it offers a one-time prompt
  to type a custom data path — your answer is saved to `settings.json` `adapterRoots` and
  detection retries there. (Press Enter to skip.)
- `tt adapters` shows each adapter's detected paths, last scan, and warnings.
- Claude Code sessions older than ~30 days are auto-deleted by Claude Code itself —
  that's fine; Token Tamers persists what it has ingested into its own store
  (`~/.tokentamers/`).
