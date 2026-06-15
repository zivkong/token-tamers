# Getting Started

## Install

See the [README](../../README.md#install) for per-OS install instructions
(standalone binaries on every GitHub Release; `tt.js` for Node ≥ 20 users).

## `tt init` — the only required interaction, ever

1. **Detection** — probes for installed agents (Claude Code: `~/.config/claude/projects/`
   or `~/.claude/projects/`; OpenCode: `~/.local/share/opencode/`).
2. **Cycle** — one choice for your whole pet (it has a single life), not per adapter:
   - _Subscription with limit windows_ (Claude Pro/Max, ChatGPT plans) → **subscription
     cycle**: molt windows are inferred from your real usage gaps in a chosen **anchor
     adapter** (the provider whose subscription rhythm sets the clock). If you've enabled
     more than one adapter, you pick which is the anchor; the others still feed your pet.
   - _API / pay-as-you-go / mixed_ → **static cycle**: fixed 5-hour windows and a 7-day
     week anchored to a configurable epoch (default: next Monday 00:00 local).

   Either way, adapters are just data sources — within one adapter, API and subscription
   usage both count (the game never judges how you pay).

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
(`~/.tokentamers/`), the opt-in update mode, and your configured adapters (read-only). The
editable fields — press **↑↓** to focus and **←→** to change — are the **Updates** mode
(`off ▸ notify ▸ auto`; see below), the pet-global **Cycle** policy (subscription/static), and,
when you're on subscription with more than one adapter, the **Anchor** adapter. The update mode
saves to `~/.tokentamers/settings.json` and the cycle to `config.json`; both apply the next time
you launch `tt` (the cycle reshapes molt windows, so it never shifts mid-session under your pet).
Adding or removing an agent, or changing scan paths, is still done by re-running `tt init`. You
can also print the version non-interactively with `tt --version`.

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

## Updating Token Tamers

Token Tamers is **fully offline, and it stays that way by default** — checking for updates is
strictly opt-in. Updates only ever come from the project's GitHub Releases, the download is
**verified by SHA-256** before anything is applied, and **no data about you is ever sent** —
the updater only fetches, it tells GitHub nothing.

- **`tt update`** — check on demand and update now. Standalone binaries download the matched
  release, verify it, and swap themselves in place; `tt.js` / Node runs print the release
  page to update from. Run it whenever you like; nothing happens until you do.
- **Update mode** (default `off`) — how the game checks on its own, if at all:
  - `off` — never touches the network (the default).
  - `notify` — checks ~once a day and shows a "vX available" hint on the Settings page.
  - `auto` — `notify`, plus self-updating the standalone binary (verified) on next launch.

You can set the mode three ways, all starting from `off`:

- **During `tt init`** — the Preferences step asks once ("Updates — off keeps the game fully
  offline"); just press Enter to stay off.
- **On the Settings page** — press **4**, highlight the **Updates** row, and press **←/→** to
  cycle `off ▸ notify ▸ auto` (it's the first editable row, above the adapters).
- **By hand** — edit `update.mode` in `~/.tokentamers/settings.json`.

Either UI just records your choice; it takes effect on the next launch, and turning it on is the
only thing that ever lets the game reach the network. So out of the box the game makes **zero
network connections** — you opt in only if you want it.

## Troubleshooting adapter detection

- When `tt init` can't find an agent at its default locations, it offers a one-time prompt
  to type a custom data path — your answer is saved to `settings.json` `adapterRoots` and
  detection retries there. (Press Enter to skip.)
- `tt adapters` shows each adapter's detected paths, last scan, and warnings.
- Claude Code sessions older than ~30 days are auto-deleted by Claude Code itself —
  that's fine; Token Tamers persists what it has ingested into its own store
  (`~/.tokentamers/`).
