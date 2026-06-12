## What

<!-- One concern per PR. What does this change and why? -->

## Invariant checklist

- [ ] **Offline** — no network-capable code introduced anywhere
- [ ] **Read-only** — never calls an AI API, never spends user tokens/quota
- [ ] **No model judgment** — model IDs affect identity/cosmetics only, never stats/grades/speed
- [ ] **Additive-only** — no species/trait/achievement/habitat/trinket id removed or renumbered
- [ ] **Deterministic core** — no wall clock or ambient randomness in `packages/core`
- [ ] **No new dependencies** — runtime deps stay at zero; dev-dep changes link an approved issue
- [ ] **No spoilers** — fusion-pool contents stay out of docs/wiki/README
- [ ] **Tests honest** — no test weakened to make this pass; new behavior has tests
- [ ] `pnpm check` passes locally

## Notes for the reviewer

<!-- Anything reviewers should focus on: contracts touched, design-doc sections, trade-offs. -->
