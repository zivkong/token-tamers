<div align="center">

# 🐲 Token Tamers

### Your work raises a monster. _Literally._ Whatever agent you use.

A fully idle, fully offline **terminal virtual pet** for developers — raised passively by
your real AI coding-agent usage. No clicks. No chores. No API calls. You ship code;
your monster evolves.

[![Release](https://img.shields.io/github/v/release/zivkong/token-tamers?label=release)](https://github.com/zivkong/token-tamers/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

<p align="center">
  <img src="docs/assets/readme-shell.gif" alt="The Token Tamers shell: an S-grade Aurelion shimmering over the Rooftop Night habitat, with the clickable menu and completion meter" width="780">
</p>

<div align="center">

_Real footage — the actual renderer drew every frame of that GIF._
_Half-block pixel-art sprites · clickable 4:3 canvas · 30 fps on &lt;2% CPU · works over SSH_

`tt status` → `🥚 Wisp [B]● molt 4 ▓▓░░` — yes, it fits in your statusline.

</div>

---

## 🤝 The three pledges

Trust is the whole game. Each pledge is **mechanically enforced in CI**, not just promised:

|     | Pledge                                  | What it means                                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔒  | **Read-only. Never spends your tokens** | Token Tamers never calls an AI API and never touches your quota. It only _reads_ the usage logs your agent already writes to disk. Your pet grows because you shipped real work.                                                                                                                            |
| 🔌  | **Fully offline by default**            | No telemetry, no sync, ever. The game makes zero network connections; the sole exception is the **opt-in, off-by-default** updater (`tt update` — fetches verified releases from GitHub, sends nothing). CI confines _all_ network code to one audited file. Social features are humans pasting text codes. |
| ⚖️  | **No model judgment**                   | Model choice shapes your pet's _species and looks_ — never its stats, grades, or speed. Progress is normalized to **your own baseline**: a small-model dev and a frontier-model dev raise equally strong pets.                                                                                              |

## 🧬 How it works

Your coding agent already writes session logs locally. Token Tamers watches them — and
turns your real work patterns into a creature:

```text
 you ship code ──▶ tokens & sessions ──▶ 🥚 essence
      ▲                                      │
      │            🥚 egg fast-hatches ~10 min after first usage
      │            🐣 every 5-hour window close = MOLT
      │            the moment your pet evolves, rolls a trait,
      │            mutates, or grades up
      │                                      │
      └── new egg ◀── REBIRTH (weekly) ◀─────┘
            lineage carries 30–70% forward, forever
```

- **Your rhythm becomes traits** — code after midnight and your pet turns _Nightshade_;
  ride a session window to its cap and it earns _Marathoner_; juggle many short
  sessions and a _Swarm_ emerges. Nine traits, four hidden pattern forms.
- **Your model mix becomes identity** — `claude-*` feeds House **Aether** (ethereal),
  `gpt-*`/`o*` House **Cipher** (glyphs), `gemini-*` House **Flux** (light), open-weight
  models House **Forge** (ember). Identity only — no House is stronger.
- **Grades are a slow, honest thrill** — every molt rolls C→B→A→S with **published
  odds** (25% / 10% / 3%, activity-modified, A→S hard-capped at 6%). Grades never go
  down. No pity timer. The UI always shows your exact odds. A heavy session also adds a
  small, **capped Food bonus** to that molt's roll (full at 200M tokens) — push more before
  a window closes; the on-screen **Food** meter shows it fill.

| ○ C · Slate            | ● B · Verdant    | ◆ A · Violet                       | ★ S · Aurum                                       |
| ---------------------- | ---------------- | ---------------------------------- | ------------------------------------------------- |
| flat 4-color, charming | 8 colors, blinks | 16 colors, dithered shading, glint | full 24-bit ramps, shimmer sweep, particle aura ✦ |

**The goal: 100% completion.** Fill the Dex (112 slots, more landing each release), earn every achievement,
unlock every habitat and trinket. One number to drive to 100 — `tt complete`.

And if you stop coding for a week? Your pet curls into a cocoon — **Dormant, never
dead** — and wakes when you return. Generation 14 will be waiting.

## 📦 Install & update

**macOS & Linux** — one line, no Node, no sudo. Detects your platform, verifies the
download against `SHA256SUMS.txt`, and installs `tt` to `~/.local/bin`:

```sh
curl -fsSL https://github.com/zivkong/token-tamers/releases/latest/download/install.sh | sh
```

**To update**, re-run that exact line — it replaces `tt` in place with the latest release
(`tt --version` shows what you're on). **To uninstall**, swap `install` → `uninstall`:

```sh
curl -fsSL https://github.com/zivkong/token-tamers/releases/latest/download/uninstall.sh | sh
```

Token Tamers is just one binary plus the `~/.tokentamers/` folder — and that folder
**survives every update, reinstall, and uninstall**, because DNA and hashes parse across
all versions. You never lose a generation. To erase your pet too, uninstall with
`TT_PURGE=1`.

Each step is tunable with an environment variable:

| Variable         | Default        | What it does                                       |
| ---------------- | -------------- | -------------------------------------------------- |
| `TT_VERSION`     | `latest`       | install or pin a specific tag, e.g. `v1.2.0`       |
| `TT_INSTALL_DIR` | `~/.local/bin` | where `tt` is installed into / removed from        |
| `TT_PURGE`       | `0`            | set `1` so uninstall also deletes `~/.tokentamers` |

Cautious about piping to `sh`? Download the script, read it, then run it — e.g.
`curl -fsSL …/install.sh -o install.sh && sh install.sh`. Every asset is signed: verify
provenance with `gh attestation verify <file> --repo zivkong/token-tamers`.

<details>
<summary><strong>🪟 Windows (PowerShell)</strong></summary>

```powershell
Invoke-WebRequest -Uri https://github.com/zivkong/token-tamers/releases/latest/download/tt-windows-x64.exe -OutFile "$env:LOCALAPPDATA\tt.exe"
# then add %LOCALAPPDATA% to your PATH, or move tt.exe somewhere already on it
```

</details>

<details>
<summary><strong>⬢ Node ≥ 20 (any OS) / from source</strong></summary>

```sh
# portable single file, zero dependencies
curl -fsSL -o tt.js https://github.com/zivkong/token-tamers/releases/latest/download/tt.js
node tt.js --version

# or build it yourself
git clone https://github.com/zivkong/token-tamers.git && cd token-tamers
pnpm install && pnpm build
node apps/cli/dist/tt.js --version

# or run straight from source, no build (see Contributing → Local development)
pnpm install && pnpm dev --version
```

</details>

## ⚡ Quickstart

```sh
tt init     # one-time wizard: detects your agents, learns your baseline
tt          # the shell — meet your egg 🥚 (q to quit)
```

`tt init` is the **only required interaction, ever** (pillar one: the game is your
job). Your egg hatches ~10 minutes after your first session closes. Your first week
hatches a **Calibration Egg** while it learns what "normal" looks like for _you_ —
then the real lineage begins.

| Command       | What it does                                           |
| ------------- | ------------------------------------------------------ |
| `tt`          | The clickable shell: Pet, Dex, Archive, Settings pages |
| `tt watch`    | Slim live view                                         |
| `tt status`   | One-line status — drop it in your prompt / statusline  |
| `tt dex`      | Collection progress, "???" silhouettes included        |
| `tt archive`  | Hall of Fame: your best record per species             |
| `tt complete` | The completion meter, your % toward 100                |
| `tt adapters` | Adapter health, paths, warnings                        |

Everything honors `--no-color` and degrades gracefully: truecolor → 256 → 8 → ASCII.

## 🔌 Supported agents

| Agent       | Status  | Reads (locally, read-only)                      |
| ----------- | ------- | ----------------------------------------------- |
| Claude Code | ✅ now  | `~/{.config/claude,.claude}/projects/*/*.jsonl` |
| OpenCode    | ✅ now  | `~/.local/share/opencode/`                      |
| Codex CLI   | 🔜 next | `$CODEX_HOME/sessions/**/rollout-*.jsonl`       |

Adapters emit one normalized event stream; the engine never knows which agent fed it.
Multiple agents feed **one pet** — a second agent diversifies its diet, never inflates
its power. Cross-agent diets unlock hybrid species. 🧪

## ❓ FAQ

<details>
<summary><strong>Does this spend my tokens or API credits?</strong></summary>

No. Never. It reads log files your agent already wrote. There is no network-capable
code in this repository — ESLint bans the imports and CI greps every PR.

</details>

<details>
<summary><strong>Is my data sent anywhere?</strong></summary>

No. Everything lives in `~/.tokentamers/` on your machine. The "shared world" (weekly
weather, future Drifter DNA) is derived deterministically from the calendar, so every
offline machine agrees without ever talking.

</details>

<details>
<summary><strong>I only use small/local models — is my pet weaker?</strong></summary>

No. Progression normalizes to <em>your own</em> baseline; model mix only flavors
species identity. This promise is pillar #2 of the design and tests enforce it.

</details>

<details>
<summary><strong>What's with the S-grade obsession?</strong></summary>

A→S is a ~3–6% roll, once per molt, never guaranteed, never lost. When it lands, your
pet's palette upgrades <em>live</em> — gold ramps, shimmer sweep, particle aura. People
screenshot it. That's the point.

</details>

## 🗺️ Roadmap

- [x] **M1 — the MVP (you are here):** Claude Code + OpenCode adapters · evolution engine
      (Aether + Cipher lines, egg → Apex) · traits, patterns, mutations · grade rolls ·
      rebirth + lineage · the Archive · clickable TUI · 12 habitats, 6 trinkets,
      41 achievements
- [ ] **M2:** Codex CLI adapter · Flux + Forge + hybrid lines · DNA
      export/apply (paste codes to friends) · deterministic battles · fusion pools 🤫 ·
      Team Leagues · Drifter DNA for solo devs
- [ ] **M3:** seasonal content packs · monthly weather events · sprite compiler pipeline

Full design reference: [`docs/design/`](docs/design/) · player wiki: [`docs/wiki/`](docs/wiki/)

## 🛠️ Contributing

Token Tamers is **AI-native open source**: built entirely with AI coding agents, kept
honest by mechanical gates — import-boundary lint, determinism tests, golden-frame
snapshots, zero-network and spoiler checks, supply-chain pins. Humans own architecture;
CI owns quality; AI writes the code. Start at [CONTRIBUTING.md](CONTRIBUTING.md) —
your agent will feel right at home.

### Local development

Prereqs: **Node ≥ 20** and **pnpm** (via Corepack — `corepack enable`). Then:

```sh
git clone https://github.com/zivkong/token-tamers.git && cd token-tamers
pnpm install
pnpm dev init         # one-time setup (writes to ~/.tokentamers)
pnpm dev:watch        # run the shell from source with hot reload — press 4 for Settings
```

| Command           | What it does                                                                          |
| ----------------- | ------------------------------------------------------------------------------------- |
| `pnpm dev`        | Run `tt` straight from TypeScript source via `tsx` — no build step                    |
| `pnpm dev:watch`  | Same, with **hot reload**: restarts on any source edit, in any workspace package      |
| `pnpm dev <args>` | Forward a command/flag, e.g. `pnpm dev status`, `pnpm dev init`, `pnpm dev --version` |
| `pnpm test:watch` | Run the test suite in watch mode                                                      |
| `pnpm build`      | Bundle the standalone binary → run it with `node apps/cli/dist/tt.js`                 |
| `pnpm check`      | The full gate CI runs: typecheck · lint · format · test · build                       |

A few things worth knowing:

- **No per-package build.** Every workspace package exports its `src/index.ts`, so `tsx`
  resolves the whole app from source — edits anywhere under `packages/*/src` or
  `apps/cli/src` are picked up on the next `dev:watch` restart.
- **Bare `pnpm dev` opens the interactive shell**, which needs a one-time `pnpm dev init`
  first. The TUI takes over the terminal; `q` or `Ctrl-C` exits, and `dev:watch`
  re-launches it after each save.
- **Config lives in files, never environment variables.** Token Tamers reads zero config
  from `process.env`. Preferences go in `~/.tokentamers/settings.json` (hand-editable):
  `color` (`auto` · `truecolor` · `256` · `8` · `none`) and `adapterRoots` — override where
  each adapter scans, e.g. point `claude-code` at a fixture dir. The data dir itself is
  fixed at `~/.tokentamers`; dev shares your real store, so inspect/commit with that in mind.
- **Before pushing**, run `pnpm check` (plus `pnpm check:network` and `pnpm check:spoilers`);
  the git hooks run these for you, but running them early is faster.

<div align="center">

**[MIT](LICENSE)** © 2026 Ziv Kong

⭐ Star the repo — then go write some code. Your egg is counting on you. 🥚

</div>
