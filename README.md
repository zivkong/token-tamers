# Token Tamers

> **Your work raises a monster. Literally. Whatever agent you use.**

Token Tamers is a **fully idle, fully offline terminal virtual pet** for developers.
An evolving monster companion is raised passively by your real AI coding-agent usage —
no interaction required. A read-only observer watches the **local session logs** of your
coding agent (Claude Code in the MVP; Codex CLI and OpenCode next) and converts your
actual work patterns into pet growth, evolution, grades, and a collection to complete.

```
┌──────────────────────────────────────────────┐
│ ╔══════════════ 4:3 CANVAS ══════════════╗   │
│ ║        habitat · pet · trinkets        ║   │
│ ║      (half-block pixel-art sprites)    ║   │
│ ╚════════════════════════════════════════╝   │
├──────────────────────────────────────────────┤
│ [♥Pet] [☰Dex] [◆Archive] [⚙]          12.5% │
└──────────────────────────────────────────────┘
```

## The three pledges

1. **Read-only — it never spends your tokens.** Token Tamers never calls any AI API and
   never touches your quota or subscription. It only *reads* the usage logs your agent
   already writes to disk. Your pet grows because you shipped real work.
2. **Fully offline — zero network code.** No API calls, no telemetry, no update checks,
   no sync. CI fails the build if any network-capable code is ever introduced. Social
   features work by humans pasting text codes to each other.
3. **No model judgment.** Model choice only influences your pet's *species identity and
   cosmetics* — never stats, grades, or progression speed. All power metrics are
   normalized against **your own baseline**. An all-light-model dev and an all-frontier-model
   dev with similar work patterns raise equally strong pets.

## How it works

- Your coding agent writes session logs locally (e.g. `~/.claude/projects/**/*.jsonl`).
- Token Tamers ingests them incrementally and maps them to game events:
  - **Token consumption** → nutrition/essence (normalized to your own baseline)
  - **Model-ID mix** → diet → House/species identity (Aether, Cipher, Flux, Forge, Wild)
  - **5-hour session window close** → **Molt**: the only moment a pet can evolve,
    roll a trait, mutate, or attempt a grade-up (C → B → A → S, never down)
  - **Week boundary** → **Rebirth**: the pet ascends into the Archive, a new egg
    hatches with lineage carry-over
- The goal is **100% completion**: every Dex entry, achievement, habitat, and trinket.

## Install

Token Tamers ships standalone binaries (no Node.js required) on every
[GitHub Release](https://github.com/zivkong/token-tamers/releases), plus a portable
`tt.js` for anyone with Node ≥ 20.

### macOS

```sh
# Apple Silicon (use tt-macos-x64 for Intel)
curl -fsSL -o tt https://github.com/zivkong/token-tamers/releases/latest/download/tt-macos-arm64
chmod +x tt && sudo mv tt /usr/local/bin/
# The binary is unsigned; on first run macOS may quarantine it:
xattr -d com.apple.quarantine /usr/local/bin/tt 2>/dev/null || true
```

### Linux

```sh
# x64 (use tt-linux-arm64 for ARM)
curl -fsSL -o tt https://github.com/zivkong/token-tamers/releases/latest/download/tt-linux-x64
chmod +x tt && sudo mv tt /usr/local/bin/
```

### Windows (PowerShell)

```powershell
Invoke-WebRequest -Uri https://github.com/zivkong/token-tamers/releases/latest/download/tt-windows-x64.exe -OutFile "$env:LOCALAPPDATA\tt.exe"
# then add %LOCALAPPDATA% to your PATH, or move tt.exe somewhere already on it
```

### With Node.js (any OS)

```sh
curl -fsSL -o tt.js https://github.com/zivkong/token-tamers/releases/latest/download/tt.js
node tt.js --version
```

### From source

```sh
git clone https://github.com/zivkong/token-tamers.git
cd token-tamers
pnpm install && pnpm build
node apps/cli/dist/tt.js --version
```

Verify any download against `SHA256SUMS.txt` on the release page.

## Quickstart

```sh
tt init     # one-time wizard: detects your agents, asks plan type, backfills your baseline
tt          # the clickable shell — watch your pet live (q to quit)
```

`tt init` is the **only required interaction, ever**. From then on the game is your job:
keep coding with your agent and check in whenever you like. Your first week hatches a
**Calibration Egg** while your personal baseline is established.

## Commands

| Command       | What it does                                              |
| ------------- | --------------------------------------------------------- |
| `tt init`     | One-time setup wizard (re-run to add/remove adapters)      |
| `tt`          | The clickable 4:3 shell: Pet, Dex, and Archive pages       |
| `tt watch`    | Slim live view                                             |
| `tt status`   | One-shot status line (statusline-friendly)                 |
| `tt dex`      | Dex listing in plain text                                  |
| `tt archive`  | Best-record Hall of Fame per species                       |
| `tt complete` | Completion meter with per-page breakdown                   |
| `tt adapters` | Adapter health: detected paths, last scan, warnings        |

All commands honor `--no-color` (pure-ASCII fallback) and degrade gracefully from
truecolor → 256-color → 8-color terminals.

## Supported agents

| Agent       | Status      | Data source (read-only)                        |
| ----------- | ----------- | ----------------------------------------------- |
| Claude Code | ✅ MVP       | `~/.claude/projects/**/*.jsonl`                 |
| Codex CLI   | 🔜 planned   | `$CODEX_HOME/sessions/**/rollout-*.jsonl`       |
| OpenCode    | 🔜 planned   | `~/.local/share/opencode/storage/`              |

Adapters are plugins emitting one normalized event stream; the engine never knows which
agent produced an event. Multi-agent setups feed **one pet** — adding a second agent
diversifies its diet, never inflates its power.

## FAQ

**Does this use my tokens / API credits?** No. Never. It reads log files your agent
already wrote. There is no code in this repository capable of making a network request,
and CI enforces that.

**Is my data sent anywhere?** No. Everything lives in `~/.tokentamers/` on your machine.

**I only use cheap/local models — is my pet weaker?** No. Progression is normalized to
*your own* usage baseline. Model mix only flavors species identity (Houses).

**What if I stop coding for a week?** Your pet goes **Dormant** (a cocoon, not death) and
wakes when you return. Lineage always accrues; re-entry is always warm.

## Roadmap

- **M1 (this MVP):** Claude Code adapter, evolution engine (Aether + Cipher lines, egg → Apex),
  traits, patterns, mutations, grade rolls, rebirth + lineage, Archive, clickable TUI shell,
  3 habitats, 6 trinkets, ~30 achievements, completion meter.
- **M2:** Codex CLI + OpenCode adapters, Flux + Forge + hybrid lines, DNA export/apply,
  deterministic battles, fusion pools, Team Leagues, Drifter DNA for solo devs.
- **M3:** Seasonal content packs, monthly weather events, sprite compiler pipeline.

See [`token-tamers-design.md`](token-tamers-design.md) for the full design document and
[`docs/wiki/`](docs/wiki/) for the player & contributor wiki.

## Contributing

Token Tamers is an open-source, **AI-native** project — it is built entirely with AI
coding agents, guarded by mechanical CI gates (import boundaries, determinism rules,
zero-network checks, perf budgets). Humans own architecture and contracts; CI owns
quality; AI writes the code. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2026 Ziv Kong
