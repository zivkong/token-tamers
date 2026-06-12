<div align="center">

# 🐲 Token Tamers

### Your work raises a monster. _Literally._ Whatever agent you use.

A fully idle, fully offline **terminal virtual pet** for developers — raised passively by
your real AI coding-agent usage. No clicks. No chores. No API calls. You ship code;
your monster evolves.

[![CI](https://github.com/zivkong/token-tamers/actions/workflows/ci.yml/badge.svg)](https://github.com/zivkong/token-tamers/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/zivkong/token-tamers?label=release)](https://github.com/zivkong/token-tamers/releases/latest)
[![Runtime deps](https://img.shields.io/badge/runtime_deps-0-success)](#-the-three-pledges)
[![Network calls](https://img.shields.io/badge/network_calls-0_ever-blueviolet)](#-the-three-pledges)
[![Node](https://img.shields.io/badge/node-%E2%89%A5_20-brightgreen)](#-install)
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

|     | Pledge                                  | What it means                                                                                                                                                                                                  |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔒  | **Read-only. Never spends your tokens** | Token Tamers never calls an AI API and never touches your quota. It only _reads_ the usage logs your agent already writes to disk. Your pet grows because you shipped real work.                               |
| 🔌  | **Fully offline. Zero network code**    | No telemetry, no update checks, no sync — there is no code in this repo _capable_ of a network request, and a CI gate fails any PR that tries. Social features are humans pasting text codes.                  |
| ⚖️  | **No model judgment**                   | Model choice shapes your pet's _species and looks_ — never its stats, grades, or speed. Progress is normalized to **your own baseline**: a small-model dev and a frontier-model dev raise equally strong pets. |

## 🧬 How it works

Your coding agent already writes session logs locally. Token Tamers watches them — and
turns your real work patterns into a creature:

```text
 you ship code ──▶ tokens & sessions ──▶ 🥚 essence
      ▲                                      │
      │            every 5-hour window close = MOLT 🐣
      │            the only moment your pet can evolve,
      │            roll a trait, mutate, or grade up
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
  down. No pity timer. The UI always shows your exact odds.

| ○ C · Slate            | ● B · Verdant    | ◆ A · Violet                       | ★ S · Aurum                                       |
| ---------------------- | ---------------- | ---------------------------------- | ------------------------------------------------- |
| flat 4-color, charming | 8 colors, blinks | 16 colors, dithered shading, glint | full 24-bit ramps, shimmer sweep, particle aura ✦ |

**The goal: 100% completion.** Fill the Dex (112 entries), earn every achievement,
unlock every habitat and trinket. One number to drive to 100 — `tt complete`.

And if you stop coding for a week? Your pet curls into a cocoon — **Dormant, never
dead** — and wakes when you return. Generation 14 will be waiting.

## 📦 Install

**macOS & Linux** — one line. Detects your platform, verifies the download against
`SHA256SUMS.txt`, and installs `tt` to `~/.local/bin` (no Node, no sudo):

```sh
curl -fsSL https://github.com/zivkong/token-tamers/releases/latest/download/install.sh | sh
```

Pin a release with `TT_VERSION=v1.2.0` or retarget with `TT_INSTALL_DIR=/usr/local/bin`.
Rather read it before running? `curl -fsSL …/install.sh -o install.sh`, inspect, then
`sh install.sh`. Every asset — the installer included — carries build provenance:
`gh attestation verify <file> --repo zivkong/token-tamers`.

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
```

</details>

## ⚡ Quickstart

```sh
tt init     # one-time wizard: detects your agents, learns your baseline
tt          # the shell — meet your egg 🥚 (q to quit)
```

`tt init` is the **only required interaction, ever** (pillar one: the game is your
job). Your first week hatches a **Calibration Egg** while it learns what "normal" looks
like for _you_ — then the real lineage begins.

| Command       | What it does                                          |
| ------------- | ----------------------------------------------------- |
| `tt`          | The clickable shell: Pet, Dex, and Archive pages      |
| `tt watch`    | Slim live view                                        |
| `tt status`   | One-line status — drop it in your prompt / statusline |
| `tt dex`      | Collection progress, "???" silhouettes included       |
| `tt archive`  | Hall of Fame: your best record per species            |
| `tt complete` | The completion meter, your % toward 100               |
| `tt adapters` | Adapter health, paths, warnings                       |

Everything honors `--no-color` and degrades gracefully: truecolor → 256 → 8 → ASCII.

## 🔌 Supported agents

| Agent       | Status  | Reads (locally, read-only)                |
| ----------- | ------- | ----------------------------------------- |
| Claude Code | ✅ now  | `~/.claude/projects/**/*.jsonl`           |
| Codex CLI   | 🔜 next | `$CODEX_HOME/sessions/**/rollout-*.jsonl` |
| OpenCode    | 🔜 next | `~/.local/share/opencode/storage/`        |

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

- [x] **M1 — the MVP (you are here):** Claude Code adapter · evolution engine
      (Aether + Cipher lines, egg → Apex) · traits, patterns, mutations · grade rolls ·
      rebirth + lineage · the Archive · clickable TUI · 3 habitats, 6 trinkets,
      32 achievements
- [ ] **M2:** Codex CLI + OpenCode adapters · Flux + Forge + hybrid lines · DNA
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

<div align="center">

**[MIT](LICENSE)** © 2026 Ziv Kong

⭐ Star the repo — then go write some code. Your egg is counting on you. 🥚

</div>
