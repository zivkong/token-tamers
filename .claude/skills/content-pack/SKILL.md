---
name: content-pack
description: Schema and rules for Token Tamers content packs (species, traits, models.json, achievements, habitats, trinkets). Use when adding or changing anything under packages/content.
---

# Content pack rules

- Content lives in versioned JSON under `packages/content/content/v1/` and is exported
  as a typed `ContentPack` from `packages/content/src/index.ts` (bundled into the cli —
  no runtime file reads). Schemas: `packages/core/src/types.ts`.
- **Additive-only:** never remove or renumber an id (species `num`, trait id,
  achievement id, …). Retiring content = mark it Ancient, keep the entry.
- **models.json:** ordered pattern rules, first match wins; `claude-*`→aether,
  `gpt-*`/`o*`→cipher, `gemini-*`→flux, open-weight families→forge; anything
  unmatched → `wild` (dormant gene, renders as "???" until a pattern is added).
- Houses/model IDs are identity & cosmetics ONLY. Equal stat budgets per stage across
  all species — `statWeights` redistribute, never exceed the budget (no-model-judgment
  pillar; tests enforce equal totals).
- Evolution branching is data (`evolvesTo[].when` BranchConditions), never engine code.
- Achievement conditions/rewards are declarative (`AchievementCondition`/`Reward`).
- **Spoilers:** fusion-pool contents (M2+) may exist only under `packages/content/`;
  never in docs/wiki/README. CI greps.
- Validate with the pack tests in `packages/content` (`pnpm test`).
