---
name: develop-game-engine
description: Game-engine rules for Token Tamers — cycle policies, molts/rebirth, evolution, traits, grade rolls, lineage, Archive, determinism requirements. Use when working under packages/core or changing any gameplay mechanic.
---

# Develop the game engine (packages/core)

Source of truth: `docs/design/lifecycle-and-cycles.md`,
`docs/design/evolution-grades-lineage.md`, and `docs/design/dna-hash-battles.md`. The engine is PURE and
DETERMINISTIC: no I/O, no `Date.now()`/`new Date()`/`Math.random()` (ESLint enforces) —
time enters as event timestamps, randomness via the seeded RNG (`src/rng.ts`,
mulberry32, serializable state). Same saved state + same events + same clock ⇒
identical results, forever. The engine is provider-blind: it consumes only normalized
`UsageEvent`s and cycle events.

## The canonical cycle rule (never violate)

- **Evolution cycle = the 5-hour session window.** Every closed window containing
  usage fires a MOLT_CHECKPOINT — the ONLY moment a pet can change stage, roll a
  trait, mutate, evolve, or attempt a grade-up. Nothing evolves between molts. A
  molt is the OPPORTUNITY to evolve, not a guarantee: each stage must accrue its
  **maturity** requirement (`pet.stageMolts` vs `STAGE_MATURITY`) and clear any
  quality gate (`STAGE_GATE`, e.g. prime→apex needs grade ≥ B) before it advances —
  pacing the egg→apex climb across ~5 active days. See `engine/maturity.ts`.
- **Weekly cycle = rebirth, nothing else.** The week boundary fires REBIRTH only:
  ascension, legacy scoring, Archive record, inheritance roll, new egg. The pet's
  final form is whatever it became at the week's **last molt** — rebirth never
  evolves it.
- **Egg fast-hatch (the sole exception).** Each week's egg→sprite hatch fires on a
  bonus checkpoint ≈10 min after that week's first usage (`EGG_HATCH_MS`,
  `eggHatchMolts`), not at a 5-h close. It is an ADDITIVE `{hatch:true}` molt layered
  on the normal window chain (one per week — every generation starts as an egg at a
  rebirth); `replayMolt` makes it act only while the pet is an egg, else a no-op, so
  the normal windows / pending buffer / determinism are untouched. It hatches +
  rolls like a molt but skips diet and `updateBaseline` (normalization comes only
  from real 5-h windows). ONLY the hatch bypasses the 5-h rule; every later molt
  obeys it. Keep the checkpoint a pure fn of (events, weekAnchor) — never gate the
  window SHAPE on pet state (it reshapes the chain and breaks replay==resume).

## Cycle policies (real time → abstract events)

| Abstract event  | Dynamic policy (subscription)             | Static policy (API / OpenCode)                    |
| --------------- | ----------------------------------------- | ------------------------------------------------- |
| MOLT_CHECKPOINT | Inferred 5-h window close from usage gaps | Fixed 5-h windows from anchor; molts only if used |
| REBIRTH         | Weekly limit reset                        | Every 7 days from week anchor                     |

Multi-provider players feed ONE pet: essence is normalized per adapter against that
adapter's OWN baseline, then summed — a second agent diversifies diet, never inflates
power.

## Signal mapping

| Real-world signal                | Game meaning                                      |
| -------------------------------- | ------------------------------------------------- |
| Token consumption (any provider) | Nutrition/essence (baseline-normalized)           |
| Model-ID mix                     | Diet → House/species (identity ONLY)              |
| Session window close             | Molt                                              |
| Week boundary                    | Rebirth                                           |
| Riding a window to its cap       | Marathoner trigger                                |
| Hitting weekly limit exactly     | Rare Limitbreaker evolution (dynamic policy only) |
| Week of zero usage               | Dormant (cocoon, not death)                       |

## Weekly arc & weather

- Three acts: **Growth** (days 1–3) molts and traits accrue; **Bloom** (days 4–6) the
  form matures and one random molt fires the weekly **Bloom event** — a guaranteed
  rare roll; **Twilight** (final ~24h) legacy score crystallizes and the UI previews
  rebirth inheritance. Form is already final after the week's last molt.
- **Weekly weather:** a deterministic seed from the ISO week number biases trait
  rates ("Storm Week: Sprinter rolls doubled") — shared by every machine, fully
  offline, no server.
- Molt evaluation inputs: session count, gap rhythm, time-of-day spread, window-cap
  proximity, tool/lang diversity, streak vs burst, adapter diversity.

## Evolution

- Stage track: egg (Mote) → sprite → rookie → evolved → prime → apex.
  Behavioral branching from rookie on; rares, patterns, rising mutation chance at
  later molts. Solo reaches Apex.
- **Maturity pacing (lever A+B).** Each stage holds a maturity clock
  (`pet.stageMolts`, reset on hatch and every evolution); it may evolve only once
  `stageMolts ≥ STAGE_MATURITY[stage]` (sprite 1, rookie 2, evolved 3, prime 4 —
  rising, so growth slows) AND `evolutionGateMet` (prime→apex needs grade ≥ B).
  `growthProgress(state)` exports a SPOILER-FREE readout (fill frac + flags, never
  stage/count) for the Pet page's abstract "Grow" cue. Empty windows still never
  molt; both "≤1 stage per molt" and "grade never downgrades" still hold. All pure
  fns of persisted state ⇒ replay==resume. Constants/logic live in
  `engine/maturity.ts`; bumped `SCHEMA_VERSION` (cli store migrates `stageMolts`).
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
- Capped vitality bonus (hybrid growth): the chance is `gradeRollChance(from, modifier,
totalTokens)` = `base*modifier + vitalityBonus(totalTokens)`, A→S clamped to `A_TO_S_CAP`.
  `vitalityBonus` ramps linearly to `VITALITY_MAX_BONUS` (0.15) at `VITALITY_FULL_TOKENS`
  (200M) then clamps. This additive bonus is the ONLY place absolute volume touches power;
  the modifier stays volume-blind and the A→S cap applies AFTER it. `gradeRollChance` is the
  single source of truth — `rollGrade` (the real molt) and `gradeOdds` (the UI forecast) both
  call it, so they can never drift. Deterministic (pure fn of the window's raw tokens).
- **UI forecast:** `gradeOdds(state, pending?)` returns the next roll `{from, to, chance,
capped}` (null at the S cap) — with the open window's events it folds in the live modifier +
  vitality (what the molt will roll); with none it reports the published base odds. The pet
  page's `Odds` row shows ONLY this current→next forecast (the only roll that can fire next).
  Pure + deterministic: reads state + event timestamps, never the clock.
- Grade NEVER downgrades — not from a bad window, not from Dormancy. No pity
  guarantee. Record `lastGradeRoll` (odds shown in UI — transparency defuses RNG
  resentment). A success is a Gradeshift (cutscene moment).

## Rebirth, lineage, Dex records (unified Archive)

- Stat carry-over: 30% base +10% per stage tier reached, cap 70%; inherited trait =
  most-repeated. New egg starts at C (lineage perks may sweeten roll odds, never the
  starting grade, never to certainty).
- Lineage perks: species affinity by lineage; 3× Prism ancestors → **Kaleido** egg;
  **Progenitor** flag marks DNA donors. Perks sweeten roll odds only, never grades.
- **Dex record store (`state.dexRecords`) is the source of truth** — each species keeps
  its **top-3** snapshots, ranked grade-desc then stat-total (`engine/dex-records.ts`).
  Capture (`engine/snapshot.ts` → `tryCaptureSnapshot`) fires at every molt close,
  evolution, and rebirth via the engine's private `capture()`; the `dex_record` effect
  reports new entries. Snapshots clone stats/arrays (self-contained). Capture must stay
  deterministic (total-order insert, `recordedAt`-asc final tiebreak, equal-peak dedupe)
  so replay-from-scratch == resume-from-snapshot.
- The legacy `state.archive` (one strictly-best record per species, rebirth-only) is
  STILL written as a back-compat mirror — the grade/house achievements read it, and the
  Archive view derives best-per-species from `dexRecords` via `bestSpeciesRecords` (each
  record's `top[0]` ≡ the old strictly-best). Don't remove `archive`/`lineage`.
- Stats PWR/SPD/WIS/GRT; equal total budget per stage across species (horizontal
  evolution: different builds, never better builds).

## DNA codec, readiness gate, graft potency (M2.1 encoder shipped)

- **Codec** lives in `src/dna/` (NOT engine): `encodeDna(snapshot, {speciesNum})` → an opaque
  `TTX<v>-XXXX-…` license-key token, pure inverse `decodeDna`. Deterministic (same snapshot ⇒
  same code — required for live Dex display + battle replays). No `node:*`/`Buffer` (invariant 4)
  — hand-rolled varint + Crockford base32 + a mulberry32 whitening keystream in `dna/payload.ts`;
  body = `[FNV tag:4][whiten(payload)]`, the payload a fixed/append-only varint stream + a reserved
  `extLen` TLV area, enums encoded as indices into the **append-only** `dna/registry.ts` tables
  (invariant 7). Whitening is obfuscation, NOT encryption (the seed travels in the tag). A golden
  test locks the byte layout (never edit existing golden codes — add new ones on a schema bump);
  `decodeDna` never throws on newer schemas / unknown ids / extra trailing data.
- **Readiness gate** (`engine/maturity.ts`): a snapshot is battle/graft-eligible only once
  `stage` ≥ `BATTLE_READY_STAGE` (Evolved). `isBattleReady`/`isGraftReady`/`stageMature` are
  pure, stage-only (so a decoded foreign code's readiness is tamper-evident). Identity-based,
  never model-based (invariant 3).
- **Graft potency** (`engine/graft.ts`, `GRAFT_POTENCY` in constants): donor-grade scaled,
  C = 0 … S hard-capped at +0.08 on both grade-up chance and stat boost. Forward spec for the
  M2.3 fusion engine; `graftPotency`/`graftPotencyTier` exposed now for the Dex UI. Grade-based
  only, capped below base odds — never model/volume-derived.

## Testing requirements

Determinism property tests (replay-from-scratch == resume-from-snapshot; idempotent
re-advance), monotonic grades, molt-only evolution, window/week boundary math,
normalization invariance (10× volume or different same-House model ⇒ identical
trajectory). DNA codec: round-trip every field, a golden byte-layout lock, tamper →
`sigValid:false`, and newer-schema/garbage never throws (`__tests__/dna.test.ts`).
Dex records: top-3 keep/replace, ranking, equal-peak dedupe (`dex-records.test.ts`).
Battle code (M2) must be `f(hashA, hashB, ruleset_version)` — replays reproducible forever.
