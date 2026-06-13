# Architecture

```
[claude-code adapter]──┐
[opencode adapter]─────┼──▶ normalized UsageEvent stream ──▶ core engine ──▶ store ──▶ TUI
[codex adapter (M2)]───┘        (provider-blind)                (~/.tokentamers/)
```

- **Adapters** read each provider's local logs incrementally (per-file offset
  checkpoints) and emit normalized `UsageEvent`s. All provider quirks live here.
- **Core engine** (pure, deterministic — no I/O, no wall clock, no `Math.random`)
  derives molt/rebirth cycle events, runs evolution/traits/grades/achievements, and
  emits effects. Same state + same events + same clock ⇒ identical results, forever.
- **Content packs** are versioned JSON (species, traits, models.json, sprites,
  achievements) — content is data, never code. Registries are additive-only; unknown
  ids become dormant genes ("???").
- **TUI** renders a 4:3 canvas with half-block pixel sprites over a diff renderer
  (only changed cells emit ANSI), with a clickable bottom menu and full keyboard parity.
- **Zero network code anywhere** — enforced by ESLint rules and a CI grep.

Cross-package contracts: `packages/core/src/types.ts`. Import boundaries (ESLint):
core imports nothing; tui/adapters import core only, never each other.
