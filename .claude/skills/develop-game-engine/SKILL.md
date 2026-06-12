---
name: develop-game-engine
description: Game-engine rules for Token Tamers — cycle policies, molts/rebirth, evolution, traits, grade rolls, lineage, Archive, determinism requirements. Use when working under packages/core or changing any gameplay mechanic.
---

# Develop the game engine (packages/core)

Source of truth: `token-tamers-design.md` §5, §6, §8, §11, §12. The engine is PURE and
DETERMINISTIC: no I/O, no `Date.now()`/`new Date()`/`Math.random()` (ESLint enforces) —
time enters as event timestamps, randomness via the seeded RNG (`src/rng.ts`,
mulberry32, serializable state). Same saved state + same events + same clock ⇒
identical results, forever. The engine is provider-blind: it consumes only normalized
`UsageEvent`s and cycle events.

## The canonical cycle rule (never violate)

- **Evolution cycle = the 5-hour session window.** Every closed window containing
  usage fires a MOLT_CHECKPOINT — the ONLY moment a pet can change stage, roll a
  trait, mutate, evolve, or attempt a grade-up. Nothing evolves between molts.
- **Weekly cycle = rebirth, nothing else.** The week boundary fires REBIRTH only:
  ascension, legacy scoring, Archive record, inheritance roll, new egg. The pet's
  final form is whatever it became at the week's **last molt** — rebirth never
  evolves it.

## Cycle policies (real time → abstract events)

| Abstract event  | Dynamic policy (subscription)             | Static policy (API / OpenCode)                    |
| --------------- | ----------------------------------------- | ------------------------------------------------- |
| MOLT_CHECKPOINT | Inferred 5-h window close from usage gaps | Fixed 5-h windows from anchor; molts only if used |
| REBIRTH         | Weekly limit reset                        | Every 7 days from week anchor                     |

Multi-provider players feed ONE pet: essence is normalized per adapter against that
adapter's OWN baseline, then summed — a second agent diversifies diet, never inflates
power.

## Signal mapping

| Real-world signal                | Game meaning                            |
| -------------------------------- | --------------------------------------- |
| Token consumption (any provider) | Nutrition/essence (baseline-normalized) |
| Model-ID mix                     | Diet → House/species (identity ONLY)    |
| Session window close             | Molt                                    |
| Week boundary                    | Rebirth                                 |
| Riding a window to its cap       | Marathoner trigger                      |
| Week of zero usage               | Dormant (cocoon, not death)             |

## Evolution

- Stage track: egg (Mote) → sprite → rookie → evolved → prime → apex.
  Molts 1–2 guaranteed progression; 3–5 behavioral branching; 6+ rares, patterns,
  rising mutation chance. Solo reaches Apex.
- Branching is DATA (`evolvesTo[].when` BranchConditions): rookie fork by rhythm
  (steady/bursty); evolved 3-way by dominant trait class (endurance = Marathoner/
  Deepdiver, tempo = Sprinter/Swarm, breadth = Polyglot/Switcher); prime 3-way by
  consistency band vs own baseline; apex 2-way by lifetime arc (early-peak/late-bloom).
- One trait roll per molt, max ~5 slots. Triggers (all model-neutral): Marathoner
  (window ridden to cap), Sprinter (short bursts, long gaps), Polyglot (3+ langs),
  Nightshade (majority after midnight), Daybreaker (pre-9am), Switcher (model change
  mid-session — rewards mixing, never punishes mono-model), Deepdiver (one long
  thread), Swarm (many parallel short sessions), Polyhost (2+ adapters in a window).
- Patterns (checked every molt, locked at week's final molt): Marathoner+Nightshade →
  Vigil; Sprinter+Swarm → Tempest; any 4 distinct traits → Prism; Polyhost+Switcher →
  Chimera.
- Mutations: ~5% per molt (palette shift, off-line trait, or stat swap).
- Rhythm variants (Burnout/Disciplined/Nocturne): cosmetic variants from Evolved on.

## Grade rolls (monotonic, transparent, never guaranteed)

- Hatch at C; one roll per molt, one step at a time: C→B 25%, B→A 10%, A→S 3% base.
- Activity modifier ×0.5–×2.0 from molt-eval signals ONLY (consistency vs own
  baseline, trait synergy, rhythm quality, diversity). Token volume and model id
  NEVER enter the modifier (pillar 2). A→S hard-capped at ~6%.
- Grade NEVER downgrades — not from a bad window, not from Dormancy. No pity
  guarantee. Record `lastGradeRoll` (odds shown in UI — transparency defuses RNG
  resentment). A success is a Gradeshift (cutscene moment).

## Rebirth, lineage, Archive

- Stat carry-over: 30% base +10% per stage tier reached, cap 70%; inherited trait =
  most-repeated. New egg starts at C (lineage perks may sweeten roll odds, never the
  starting grade, never to certainty).
- Archive: one best-record slot per species; overwrite only if STRICTLY better
  (grade first, total-stats tiebreak). Records never retroactively demoted.
- Stats PWR/SPD/WIS/GRT; equal total budget per stage across species (horizontal
  evolution: different builds, never better builds).

## Testing requirements

Determinism property tests (replay-from-scratch == resume-from-snapshot; idempotent
re-advance), monotonic grades, molt-only evolution, window/week boundary math,
normalization invariance (10× volume or different same-House model ⇒ identical
trajectory). Battle code (M2) must be `f(hashA, hashB, ruleset_version)` — replays
reproducible forever.
