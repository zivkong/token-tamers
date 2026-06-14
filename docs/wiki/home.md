# Token Tamers Wiki

Your work raises a monster. Literally. Whatever agent you use.

Token Tamers is a fully idle, fully offline terminal virtual pet raised by your real
AI coding-agent usage. Start here:

- [Getting Started](getting-started.md) — install, `tt init`, plan types, troubleshooting
- [Game Guide](game-guide.md) — lifecycle, Houses, stages, traits, patterns, Dormancy
- [Grades & the Archive](grades-and-archive.md) — the C→B→A→S roll system, records, odds
- [Architecture](architecture.md) — adapters → engine → TUI, determinism, content packs

## The pledges

1. **Read-only.** Token Tamers never calls an AI API and never spends your tokens or
   quota. It only reads the local logs your agent already writes.
2. **Fully offline.** The game has zero network code, enforced by CI, and stays offline by
   default. The only network anything is the **opt-in, off-by-default updater** — and even
   that just fetches releases from GitHub (verified, no data sent). Social features are
   humans pasting text codes.
3. **No model judgment.** Model choice flavors species identity only, never power — no
   model is "better food." Grades are judged against your own baseline, with one small,
   capped bonus for feeding more before a window closes (the **Food** meter).
