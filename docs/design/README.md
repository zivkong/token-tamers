# Token Tamers — Design Reference

The normative design record, extracted in full from the v1.0.3-MVP design baseline
(June 2026, the document that drove the initial implementation). This folder is **the
contract**: PRs that change architecture or game rules must update the relevant page
in the same PR.

| Page                                                                 | Covers (original baseline sections)                                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [concept-and-pillars.md](concept-and-pillars.md)                     | Concept, platform constraint, the 8 design pillars, motivation stack (§1, §2, §16)                 |
| [lifecycle-and-cycles.md](lifecycle-and-cycles.md)                   | `tt init` wizard, cycle policies, molt/rebirth rules, weekly arc & weather (§4, §5)                |
| [evolution-grades-lineage.md](evolution-grades-lineage.md)           | Evolution system & tree, traits, patterns, rebirth/lineage, grades & the Archive (§6–§8, §12)      |
| [dna-hash-battles.md](dna-hash-battles.md)                           | DNA fusion, hash/code format, battle system (§9–§11)                                               |
| [visuals-habitats-achievements.md](visuals-habitats-achievements.md) | Visual design, rendering budgets, habitats, trinkets, achievements (§13, §14)                      |
| [architecture.md](architecture.md)                                   | TUI shell spec, stack decision, adapter layer, version-agnostic rules, AI-native policy (§15, §17) |
| [roadmap-retention-backlog.md](roadmap-retention-backlog.md)         | M1–M3 scope, year-one retention plan, implementation backlog (§18–§20)                             |

Spoiler note: fusion-locked special pool **contents** are deliberately absent from
every page here — they live only in `packages/content/content/v1/fusion-pools.json`,
and CI (`scripts/check-spoilers.sh`) fails if a pool species name appears under
`docs/`. Public docs reference DNA _types_ and riddle hints only.

Player-facing documentation lives in [`docs/wiki/`](../wiki/); day-to-day engineering
rules live in `CLAUDE.md` and the project skills under `.claude/skills/`.
