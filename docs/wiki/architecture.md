# Architecture

```
[claude-code adapter]──┐
[opencode adapter]─────┼──▶ normalized UsageEvent stream ──▶ core engine ──▶ store ──▶ TUI
[opencode adapter]─────┘        (provider-blind)                (~/.tokentamers/)
```

- **Adapters** read each provider's local logs incrementally (per-file offset
  checkpoints) and emit normalized `UsageEvent`s. All provider quirks live here.
- **Core engine** (pure, deterministic — no I/O, no wall clock, no `Math.random`)
  derives molt/rebirth cycle events, runs evolution/traits/grades/achievements, and
  emits effects. Same state + same events + same clock ⇒ identical results, forever.
- **Content packs** are Season-scoped JSON (species, traits, models.json, sprites,
  achievements, habitats, trinkets, battle) — content is data, never code. Registries are additive-only; unknown
  ids become dormant genes ("???").
- **TUI** renders a 4:3 canvas with sub-cell (octant/sextant/half-block) pixel sprites over a diff renderer
  (only changed cells emit ANSI), with a clickable six-page bottom menu (Pet · Dex · Loot · Feats · Battle · Settings) and full keyboard parity.
  The shell has six pages (hotkeys 1–6): **Pet** (lifecycle, grade odds, Reborn button) · **Dex** (per-House constellation + detail records with DNA codes) · **Loot** (equip habitats and trinkets) · **Feats** (earned achievements; locked ones show a how-to hint) · **Battle** (pick a fighter vs a pasted DNA code or own-Dex record) · **Settings**.
- **Zero network code in the game** — enforced by ESLint rules and a CI grep. The sole exception is the opt-in, off-by-default updater (`apps/cli/src/services/updater/net.ts`), which only fetches GitHub Releases and sends nothing.

Cross-package contracts: `packages/core/src/types.ts`. Import boundaries (ESLint):
core imports nothing; tui/adapters import core only, never each other.
