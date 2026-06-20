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

## Syncing your cycle

**Short version: you don't have to do anything — just run `tt`.** Every time you open the
shell or run any command, Token Tamers rescans every agent you've enabled (from where it
last left off), folds in your new usage, and advances your pet to _now_. That's the whole
sync. It's the idle pillar at work: your work raises the monster, and looking at it is all
the "syncing" there is. (As always, this only ever **reads your local logs** — never a token
spent, never a network call.)

Underneath, two things stay in step:

- **Molts** (your 5-hour evolution windows) follow your real usage automatically — inferred
  from your usage gaps on a _subscription_ cycle, or tiled from the week anchor on a _static_
  cycle. Nothing to configure beyond the one choice you made at `tt init`.
- **The weekly rebirth** lands on a 7-day boundary. By default the game keeps that boundary
  sensibly placed on its own (inferring it from your usage, or from the week anchor you chose
  at `tt init`), and it self-corrects so the boundary never drifts into the future. This works
  out of the box — it's just not pinned to the exact minute your subscription resets.

### Pinning the weekly cycle to your real reset (optional)

Want your pet's week to turn over at the _exact_ moment your subscription limit resets? Claude
Code hands that instant (`rate_limits` resets) to its **statusline** on every refresh — and
that's the only place it appears, so `tt` has to be your statusline to catch it. Point Claude
Code's statusLine at `tt statusline` by adding this to `~/.claude/settings.json`:

```json
"statusLine": { "type": "command", "command": "tt statusline" }
```

Now every refresh, `tt statusline` quietly records your real reset and prints a compact pet
line (`🐾 sprite · 5h 31% · 7d 83%`). Catch-up then anchors your weekly cycle to that exact
reset. It's **read-only and offline** — it only reads what Claude Code already computed.

**Already using another statusline (e.g. yet-another-statusline)?** Claude Code allows only one
statusLine command, so pick one:

- **Switch to `tt statusline`** — simplest, if you're happy with its line.
- **Run both** — point `statusLine.command` at a tiny wrapper script that feeds the same input
  to your existing statusline _and_ to `tt statusline`, e.g.:

  ```sh
  #!/bin/sh
  input=$(cat)
  printf '%s' "$input" | tt statusline >/dev/null   # capture the reset, hide tt's line
  printf '%s' "$input" | your-existing-statusline    # your line stays the display
  ```

- **Skip it** — the default inferred anchor is perfectly playable; the precise reset is a
  power-user nicety, not a requirement.

## Settings & version

Open `tt` and press **6** (or click **⚙ Settings**) to see what's in effect: the version
number, the current Season, where your data lives
(`~/.tokentamers/`), the opt-in update mode, and your configured adapters (read-only). The
editable fields — press **↑↓** to focus and **←→** to change — include your **Tamer** handle (stamped into every DNA code you share) and earned **Title** (Identity section, saved to `config.json`); your **Color** and **Sprites** density (Display section, saved to `settings.json`, apply live); the pet-global **Cycle** policy (subscription/static) and, when on subscription with more than one adapter, the **Anchor** adapter (Cycle section, saved to `config.json`); and the **Updates** mode (`off ▸ notify ▸ auto`; see below, saved to `settings.json`). The cycle reshapes molt windows, so it never shifts mid-session under your pet.
Adding or removing an agent, or changing scan paths, is still done by re-running `tt init`. You
can also print the version non-interactively with `tt --version`.

Token Tamers reads **no environment variables** — every preference lives in a file under
`~/.tokentamers/`. `settings.json` (hand-editable, created on demand) holds your `color`
choice (`auto` · `truecolor` · `256` · `8` · `none`; the `--no-color` flag always wins), your `subcell` sprite density (`auto` · `octant` · `sextant` · `half`; `auto` defaults to the universally-safe `half` — octant/sextant are explicit opt-in), and `adapterRoots`, which override where an adapter scans if your agent stores logs somewhere
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
  - `notify` — checks ~once a day; when a newer release is found it shows a scrolling
    "Update available — vX" ticker along the top of the Pet page, plus a "vX available" hint on
    the Settings page.
  - `auto` — `notify`, plus self-updating the standalone binary (verified) on next launch.

You can set the mode three ways, all starting from `off`:

- **During `tt init`** — the Preferences step asks once ("Updates — off keeps the game fully
  offline"); just press Enter to stay off.
- **On the Settings page** — press **6**, highlight the **Updates** row (the last editable section; Identity and Display fields appear above it, then Cycle), and press **←/→** to cycle `off ▸ notify ▸ auto`. The adapter list below is read-only.
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
