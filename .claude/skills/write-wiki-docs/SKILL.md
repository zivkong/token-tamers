---
name: write-wiki-docs
description: Style, structure, and spoiler policy for Token Tamers player/contributor documentation (docs/wiki, README). Use when writing or editing any player-facing documentation.
---

# Write wiki & docs

Source of truth: this skill (page map + policies); mechanics detail lives in
`docs/design/`. Wiki source lives in
`docs/wiki/` (synced to the GitHub wiki); keep pages in sync with content-pack
changes in the same PR.

## Page map (target)

Home/philosophy · Getting started (`tt init`, per-provider setup, plan types,
static vs dynamic cycles, 10-min egg fast-hatch, adapter troubleshooting) · Game
guide (lifecycle, egg→sprite hatch, stages, Houses, traits table, patterns,
mutations, Dormant) · Grades & the Archive (formula concepts, overwrite rules,
record→DNA economy) · Battles (M2: type wheel, trait counters, determinism,
replays) · DNA & breeding (M2) · Hash format spec · Content-pack authoring ·
Adapter authoring · Architecture.

## Tone & rules

- Warm, precise, player-first. Lead every mechanics page with what the player
  experiences, then the rules, then edge cases.
- Restate the pledges wherever relevant (they are also a README requirement):
  **read-only** (never calls an AI API, never spends tokens/quota), **fully offline**
  (zero network code, CI-enforced), **no model judgment** (model choice = identity
  and cosmetics only; progression normalized to your own baseline).
- Grade odds are public and exact — transparency defuses RNG resentment: C→B 25%,
  B→A 10%, A→S 3% base; activity modifier ×0.5–×2.0; A→S hard cap ~6%; monotonic;
  no pity guarantee.
- Never document provider names as gameplay logic — **Houses are the public
  vocabulary** (provider anonymity in battle; only Houses show).
- Dormancy is a cocoon, not death — write it as a badge of honor, never shame.
- Nothing is ever permanently missable (weather-week unlocks are re-earnable) —
  never describe limited-time content as lost.

## Spoiler policy — HINT, NEVER REVEAL (CI-enforced)

- Document _that_ fusion-locked specials exist, the apply-timing tiers, and which
  DNA _types_ exist — NEVER pool contents, special names, sprites, or stats.
- Riddle-style hints only (e.g. Vigil DNA: "those who watch through the night are
  watched back…"). Dex shows "???" silhouettes.
- Discovery is community content; datamining is inevitable but official docs never
  spoil. `scripts/check-spoilers.sh` greps docs for special-pool ids and fails CI.
