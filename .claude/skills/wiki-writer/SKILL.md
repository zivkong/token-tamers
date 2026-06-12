---
name: wiki-writer
description: Style and spoiler policy for Token Tamers docs and the docs/wiki tree. Use when writing or editing any player-facing documentation.
---

# Wiki & docs writing

- Source of truth lives in `docs/wiki/` (synced to the GitHub wiki); keep pages in sync
  with content-pack changes in the same PR.
- Tone: warm, precise, player-first. Lead every mechanics page with what the player
  experiences, then the rules, then edge cases.
- Always restate the pledges where relevant: read-only (never spends tokens), fully
  offline, no model judgment.
- **Spoiler policy — HINT, NEVER REVEAL:** document _that_ fusion-locked specials exist,
  the apply-timing tiers, and which DNA _types_ exist — never pool contents, special
  names, sprites, or stats. Riddle-style hints only (e.g. Vigil DNA: "those who watch
  through the night are watched back…"). Dex shows "???" silhouettes.
  `scripts/check-spoilers.sh` greps docs for special-pool ids and fails CI.
- Grade odds are public and exact (transparency defuses RNG resentment): C→B 25%,
  B→A 10%, A→S 3% base, activity modifier ×0.5–×2.0, A→S hard cap ~6%.
- Never document provider names as gameplay logic — Houses are the public vocabulary.
