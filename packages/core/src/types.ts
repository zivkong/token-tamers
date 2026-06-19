/**
 * Cross-package contracts for Token Tamers.
 *
 * packages/core is PURE and DETERMINISTIC: no I/O, no wall clock, no ambient
 * randomness, no imports from other workspace packages. Time enters only as
 * event timestamps; randomness only via the seeded RNG (core/rng).
 *
 * These types are the boundary contract consumed by adapters, content, tui,
 * and the cli. Extending them is fine; breaking exported shapes used by other
 * packages requires updating all consumers in the same PR.
 */

// ---------------------------------------------------------------------------
// Usage events (adapters -> engine)
// ---------------------------------------------------------------------------

/** One normalized usage record emitted by a provider adapter. */
export interface UsageEvent {
  /** Epoch milliseconds. */
  ts: number;
  /** Adapter id, e.g. 'claude-code'. */
  adapter: string;
  /** Raw model id exactly as the provider logged it, e.g. 'claude-sonnet-4-6'. */
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens?: number;
  /** Provider-side session identity (session file id). */
  sessionKey: string;
  isSubagent: boolean;
  cwd?: string;
  /** Crude breadth hints, e.g. file extensions touched in this message. */
  langHints?: string[];
}

// ---------------------------------------------------------------------------
// Identity vocabulary
// ---------------------------------------------------------------------------

export type House = 'aether' | 'cipher' | 'flux' | 'forge' | 'wild';

export type Grade = 'C' | 'B' | 'A' | 'S';

export const GRADE_ORDER: readonly Grade[] = ['C', 'B', 'A', 'S'];

export type Stage = 'egg' | 'sprite' | 'rookie' | 'evolved' | 'prime' | 'apex';

export const STAGE_ORDER: readonly Stage[] = [
  'egg',
  'sprite',
  'rookie',
  'evolved',
  'prime',
  'apex',
];

export type TraitId =
  | 'marathoner'
  | 'sprinter'
  | 'polyglot'
  | 'nightshade'
  | 'daybreaker'
  | 'switcher'
  | 'deepdiver'
  | 'swarm'
  | 'polyhost';

export type PatternId = 'vigil' | 'tempest' | 'prism' | 'chimera';

export type RhythmVariant = 'disciplined' | 'burnout' | 'nocturne';

export interface Stats {
  pwr: number;
  spd: number;
  wis: number;
  grt: number;
}

// ---------------------------------------------------------------------------
// Cycle policies (real time -> abstract molt/rebirth events)
// ---------------------------------------------------------------------------

/**
 * The pet-global cycle clock. ONE clock per pet, never per adapter — the pet has
 * a single life. The player-facing choice:
 *  - **subscription** — 5-h session windows inferred from usage gaps in the
 *    ANCHOR adapter's stream (the provider whose subscription reset rhythm drives
 *    the molt clock). Other adapters still feed essence; they never move the clock.
 *  - **static** — fixed 5-h windows tiled from `weekAnchor`; any adapter's usage
 *    can open a window.
 */
export type CyclePolicyKind = 'subscription' | 'static';

export interface CycleConfig {
  policy: CyclePolicyKind;
  /**
   * Subscription policy only: the adapter id whose usage gaps drive the inferred
   * 5-h window clock. Omitted for static. When only one adapter is configured it
   * is the implicit anchor.
   */
  anchorAdapter?: string;
  /** Epoch ms of the 7-day rebirth anchor; Monday 00:00 local by convention. Both policies. */
  weekAnchor: number;
}

/**
 * A pure data source. An adapter declares only WHERE its logs live — every token
 * it reports is essence, regardless of billing mode (API vs subscription usage in
 * one provider are NOT distinguished; invariant 3 forbids model/billing judgment).
 * The cycle clock is global (see {@link CycleConfig}), never per adapter.
 */
export interface AdapterConfig {
  provider: string;
  /** Data roots this adapter scans. */
  paths: string[];
}

export interface MoltEvent {
  type: 'molt';
  /** Window close time, epoch ms. */
  at: number;
  windowStart: number;
  windowEnd: number;
  /**
   * Egg fast-hatch checkpoint (design §5): an extra molt fired ~10 min into each
   * week's first usage, ON TOP OF the normal 5-h windows. It only acts while the
   * pet is still an egg (hatches it early); once hatched it is a no-op, so the
   * normal window chain — and thus determinism — is never disturbed.
   */
  hatch?: boolean;
}

export interface RebirthEvent {
  type: 'rebirth';
  at: number;
  weekStart: number;
  weekEnd: number;
}

export type CycleEvent = MoltEvent | RebirthEvent;

// ---------------------------------------------------------------------------
// Content pack schemas (packages/content JSON -> engine)
// ---------------------------------------------------------------------------

/** Ordered pattern rule mapping raw model ids to Houses/genes. First match wins. */
export interface ModelRule {
  /** Glob-ish pattern over model ids, '*' wildcard, e.g. 'claude-*'. */
  pattern: string;
  house: House;
  geneId: string;
  /** Hex base tint for cosmetics. */
  tint: string;
}

/** Conditions used for data-driven evolution branching, evaluated at a molt. */
export type BranchCondition =
  | { kind: 'default' }
  | { kind: 'rhythm'; value: 'steady' | 'bursty' }
  | { kind: 'traitClass'; value: 'endurance' | 'tempo' | 'breadth' }
  | { kind: 'consistency'; value: 'low' | 'mid' | 'high' }
  | { kind: 'arc'; value: 'early' | 'late' };

export interface EvolutionBranch {
  species: string;
  when: BranchCondition;
}

export interface SpeciesDef {
  /** Season this entry first shipped in (omitted = 0, the launch Season). */
  since?: number;
  /** Stable id, additive-only registry, e.g. 'aurelion'. */
  id: string;
  /** Dex number. */
  num: number;
  name: string;
  house: House | 'hybrid';
  stage: Stage;
  /** Per-stat weighting; equal total budget across all species of a stage. */
  statWeights: Stats;
  /** Branches to the next stage; empty for apex. */
  evolvesTo: EvolutionBranch[];
  /** Sprite id in the pack's sprite set. */
  spriteId: string;
  /**
   * Per-species SIGNATURE ACCENT color (hex), a SECONDARY cosmetic hue distinct
   * from the House tint. Resolves the sprite's accent band (palette indices
   * 16..18) at render time. PURELY cosmetic — like House and grade it must NEVER
   * affect stats, grades, rarity, or speed (invariant 3). Omitted ⇒ the accent
   * band falls back to the House hue.
   */
  accent?: string;
  flavor?: string;
}

export interface TraitDef {
  /** Season this entry first shipped in (omitted = 0, the launch Season). */
  since?: number;
  id: TraitId;
  name: string;
  description: string;
}

export interface PatternDef {
  /** Season this entry first shipped in (omitted = 0, the launch Season). */
  since?: number;
  id: PatternId;
  name: string;
  /** Trait combo that locks this pattern: all listed must be present, or
   * minDistinctTraits alone for prism-style patterns. */
  requiresTraits?: TraitId[];
  minDistinctTraits?: number;
}

export type AchievementCondition =
  | { type: 'stage_reached'; stage: Stage }
  | { type: 'grade_reached'; grade: Grade }
  | { type: 'trait_earned'; trait: TraitId; count: number }
  | { type: 'pattern_first'; pattern: PatternId }
  | { type: 'generation'; count: number }
  | { type: 'molt_count_lifetime'; count: number }
  | { type: 'dormant_survived' }
  | { type: 'house_apex'; house: House }
  | { type: 'dex_percent'; percent: number }
  | { type: 'distinct_traits_one_life'; count: number };

export type AchievementReward =
  | { kind: 'habitat'; id: string }
  | { kind: 'trinket'; id: string }
  | { kind: 'title'; id: string; name: string }
  | { kind: 'flair'; id: string };

export interface AchievementDef {
  /** Season this entry first shipped in (omitted = 0, the launch Season). */
  since?: number;
  id: string;
  name: string;
  description: string;
  condition: AchievementCondition;
  reward?: AchievementReward;
}

export interface HabitatDef {
  /** Season this entry first shipped in (omitted = 0, the launch Season). */
  since?: number;
  id: string;
  name: string;
  /** Scene hue (hex) for the backdrop palette; falls back to a dimmed House tint. */
  tint?: string;
  /**
   * Optional ordered list of hex colors the scene's indices map to DIRECTLY:
   * index 1 = palette[0], index 2 = palette[1], ... (index 0 stays transparent).
   * This frees a habitat from the single-tint grade ramp so the scene can be
   * genuinely multi-colored — the renderer uses these exact colors with no grade
   * ladder and no dimming. When omitted, the renderer falls back to the `tint`
   * ramp path.
   */
  palette?: string[];
  /** Palette-indexed background grid (see SpriteDef for format). */
  spriteId: string;
  /** Anchor cells (canvas-pixel coords) where trinkets render. */
  trinketSlots: Array<{ x: number; y: number }>;
}

export interface TrinketDef {
  /** Season this entry first shipped in (omitted = 0, the launch Season). */
  since?: number;
  id: string;
  name: string;
  spriteId: string;
}

/**
 * Palette-indexed sprite. `grid` rows of palette indices; 0 = transparent.
 * RGB is resolved at render time from House tint + grade LUT (palette
 * indirection — assets never store RGB).
 */
export interface SpriteDef {
  id: string;
  width: number;
  height: number;
  /** frames[frame][row][col] = palette index (0 = transparent). The idle bank. */
  frames: number[][][];
  fps: number;
  /**
   * Optional animation banks, additive to `frames`. Each bank is a frame list
   * with the SAME dims as `frames` (same width/height); the renderer selects a
   * bank by name and falls back to `frames` when the requested bank is absent.
   * Authored as small deltas of the idle base (see sprite-lib `framesFromDeltas`).
   */
  /** Walk cycle (locomotion); used while the pet is moving horizontally. */
  walk?: number[][][];
  /** Jump/hop bank; used for the short airborne hop. */
  jump?: number[][][];
  /** Play bank; used when the pet interacts with a trinket. */
  play?: number[][][];
}

export interface ContentPack {
  /**
   * Backend JSON shape version — bumps only on a breaking schema change (loader
   * migrates forward). Technical only; NEVER surfaced to players (that is `season`).
   */
  schemaVersion: number;
  /**
   * The pack's Season — the player-facing content era, starting at 0 (the launch
   * Season). Bumped once per content release (each Season). Hashes embed it as the
   * content_min floor; Dex/Archive records store it. The content tree itself is ONE
   * additive registry (packages/content/content/) — never versioned folders.
   */
  season: number;
  models: ModelRule[];
  species: SpeciesDef[];
  traits: TraitDef[];
  patterns: PatternDef[];
  achievements: AchievementDef[];
  habitats: HabitatDef[];
  trinkets: TrinketDef[];
  sprites: SpriteDef[];
  /**
   * Dex size for THIS Season — the live completion denominator (drives the
   * Dex counter, any '???' rows, and completion %). Each Season ships its own
   * obtainable roster, so 100% is reachable within the current Season.
   */
  dexTotal: number;
  /**
   * Home-House bias for hatch (cosmetic only — invariant 3). At hatch the pet's
   * essence-winning House is its "home"; with probability `houseBias` it keeps
   * home, otherwise the per-install `UserConfig.salt` deterministically picks one
   * of the other species-bearing Houses. This spreads players who feed a SINGLE
   * model (e.g. a whole company on one model) across Houses instead of locking
   * them all into one. Freely re-balanced content data; default 0.5 when absent.
   * Never affects stats/grades/speed.
   */
  houseBias?: number;
  /**
   * Battle tuning (design §11). ALL combat multipliers live here as data, never
   * hardcoded in the engine (invariant 9). The House wheel is circular and Wild
   * is neutral, so no House — and thus no model — is ever net-stronger
   * (invariant 3). See {@link BattleRuleset}.
   */
  battle: BattleRuleset;
}

// ---------------------------------------------------------------------------
// Battle system (design §11) — pure, deterministic combat over decoded DNA.
// ---------------------------------------------------------------------------

/**
 * The normalized combatant fed to the battle engine. It is the common subset of
 * a {@link DexSnapshot} and a {@link DecodedDna}, so a live pet, an Archive
 * record, and a pasted `TTX…` code all battle through ONE engine. Read-only:
 * battle never mutates a combatant (invariant 1). `stats` are the recorded
 * equal-budget values (invariant 3); the grade stat-floor is applied to a COPY
 * inside the engine, never written back.
 */
export interface Combatant {
  /** Content-pack species `num` — identity/display AND part of the battle seed. */
  speciesNum: number;
  /** Species id when resolvable (live pet / Archive record); '' for an unresolved foreign code. */
  speciesId: string;
  /** Display name when resolvable; '???' for dormant/unknown content. */
  name: string;
  house: House;
  grade: Grade;
  stage: Stage;
  stats: Stats;
  traits: TraitId[];
  /**
   * The originating tamer's handle + earned title, for display ONLY (e.g. "Vela's
   * Aether Drake" on the VS screen). Populated from a pasted code's maker's-mark;
   * undefined for your own pet/records (the UI fills in your own handle). The
   * battle simulation NEVER reads these — it stays f(stats, house, traits, grade,
   * stage, ruleset), so determinism is unaffected (invariant 1/5).
   */
  owner?: string;
  ownerTitle?: string;
}

/** One House-vs-House multiplier on the type wheel (content-tunable; §11). */
export interface HouseMatchup {
  attacker: House;
  defender: House;
  /** Damage multiplier (> 0). 1 = neutral, > 1 advantage, < 1 disadvantage. */
  multiplier: number;
}

/**
 * A trait behavioral counter (§11): when `trait` is on the attacker and
 * `counters` on the defender, the attacker's hit is amplified by `multiplier`
 * (e.g. Sprinter counters Marathoner; Deepdiver counters Swarm). Trait-based,
 * never model-based (invariant 3).
 */
export interface TraitProc {
  trait: TraitId;
  counters: TraitId;
  multiplier: number;
}

/**
 * One stat-derived combat-mechanic chance (§11). The chance is
 * `clamp(base + (stat / scale) * perPoint, 0, cap)`, where `stat` is the governing
 * EFFECTIVE stat (so grade flows in via the grade stat-floor — invariant 3, never a
 * model id). Which stat governs which mechanic is fixed game design (encoded in the
 * engine); ONLY these tuning numbers are content data (invariant 9).
 */
export interface MechanicTuning {
  /** Floor chance before the stat term (0..1). */
  base: number;
  /** Chance gained per unit of `stat / scale`. */
  perPoint: number;
  /** Stat divisor that normalizes the governing stat into the chance term (> 0). */
  scale: number;
  /** Hard cap on the resulting chance (0..1) — keeps grade an edge, never a runaway. */
  cap: number;
}

/**
 * Stat-derived combat mechanics (§11), all OPTIONAL: a ruleset without `mechanics`
 * runs the classic trade-blows fight (so older rulesets/replays are byte-identical).
 * Each mechanic rolls against the seeded battle RNG, so a fixed matchup still replays
 * forever; per-rematch variety comes from the battle `nonce` (see {@link BattleResult}).
 */
export interface BattleMechanics {
  /** Defender evades the hit entirely (no damage). Governed by SPD advantage (def.spd − atk.spd). */
  dodge: MechanicTuning;
  /** Attacker lands a critical hit, damage × `multiplier`. Governed by attacker WIS. */
  crit: MechanicTuning & { multiplier: number };
  /** Defender parries, damage × (1 − `reduction`). Governed by defender GRT. */
  parry: MechanicTuning & { reduction: number };
  /** Attacker strikes a second time the same turn. Governed by attacker SPD. */
  doubleStrike: MechanicTuning;
}

/**
 * The battle ruleset — ALL combat tuning as CONTENT DATA (invariant 9). `version`
 * is the negotiated `rulesetVersion` (§11): two codes battle under the minimum
 * common version so cross-version replays stay reproducible forever.
 */
export interface BattleRuleset {
  /** Ruleset version; battles run under the min common version of both sides. */
  version: number;
  /** The 4-House type wheel (Aether>Cipher>Flux>Forge>Aether). Wild omitted ⇒ neutral. */
  wheel: HouseMatchup[];
  /** Trait behavioral counters. */
  procs: TraitProc[];
  /** Damage variance band, 0..1 — the only stochastic term, drawn from the seeded RNG. */
  variance: number;
  /** Stat-derived combat mechanics (dodge/crit/parry/double-strike). Omitted ⇒ off (classic fight). */
  mechanics?: BattleMechanics;
}

/** Which side of a battle a combatant is on. */
export type BattleSide = 'a' | 'b';

/**
 * One entry in the deterministic battle timeline. The TUI page is PURE playback
 * of this list (no RNG at render time), so it is golden-frame testable.
 */
export interface BattleEvent {
  /** Turn ordinal (0-based). */
  turn: number;
  /** The attacking side this turn. */
  actor: BattleSide;
  kind: 'attack' | 'proc' | 'faint' | 'dodge' | 'crit' | 'parry';
  /** Damage dealt by this event (0 for a faint or a dodge). */
  damage: number;
  /** Defender HP after the event (clamped ≥ 0). */
  hpAfter: number;
  /** The trait that procced, when `kind === 'proc'`. */
  proc?: TraitId;
}

/**
 * The deterministic result of a battle: outcome + the full replayable timeline.
 * `outcome = f(combatantA, combatantB, ruleset.version, nonce)` (§11) — same inputs ⇒
 * identical result, frame for frame, forever. The canonical/shared battle uses
 * `nonce = 0` (so any holder of both codes reproduces it); a local rematch bumps the
 * nonce to reseed for variety without breaking the shared replay.
 */
export interface BattleResult {
  /** The ruleset version this battle was resolved under. */
  version: number;
  winner: BattleSide | 'draw';
  /** Starting HP per side (for HP-bar rendering). */
  startHp: { a: number; b: number };
  timeline: BattleEvent[];
}

// ---------------------------------------------------------------------------
// Game state (engine -> store/tui/cli)
// ---------------------------------------------------------------------------

export interface PetState {
  speciesId: string;
  stage: Stage;
  house: House;
  grade: Grade;
  traits: TraitId[];
  pattern: PatternId | null;
  rhythmVariant: RhythmVariant | null;
  stats: Stats;
  moltCount: number;
  /**
   * Molts accrued in the CURRENT stage (the maturity clock). A stage only
   * becomes eligible to evolve once this reaches its `STAGE_MATURITY` requirement
   * (and any quality gate is met); it resets to 0 on every stage change. This
   * paces the egg→apex climb across ~5 active days instead of one-stage-per-molt.
   * Reset to 0 at hatch (entering sprite) and at each evolution.
   */
  stageMolts: number;
  generation: number;
  hatchedAt: number;
  dormant: boolean;
  /** Calibration Egg: true until a usage baseline exists (first week). */
  calibrating: boolean;
  /** geneId -> accumulated normalized essence (diet profile). */
  dietGenes: Record<string, number>;
  /** Mutation cosmetics flags. */
  mutations: string[];
  /** Last molt's grade-up odds, for the transparency UI. */
  lastGradeRoll?: { from: Grade; to: Grade; chance: number; succeeded: boolean } | null;
}

export interface ArchiveRecord {
  speciesId: string;
  grade: Grade;
  stats: Stats;
  generation: number;
  contentVersion: number;
  recordedAt: number;
}

/**
 * One captured snapshot of a pet at a notable moment (molt close, evolution, or
 * rebirth). The unit the per-species Dex record store ranks. A superset of
 * {@link ArchiveRecord}: it carries enough to render grade/stats/traits/house/
 * generation/timestamp AND to encode a shareable DNA code. `reason` records what
 * triggered the capture (display/debug only — NEVER used in ranking).
 */
export interface DexSnapshot {
  speciesId: string;
  stage: Stage;
  grade: Grade;
  stats: Stats;
  house: House;
  traits: TraitId[];
  pattern: PatternId | null;
  rhythmVariant: RhythmVariant | null;
  mutations: string[];
  generation: number;
  /**
   * Season at capture, stored as the DNA hash's content_min floor. Backend/
   * technical (the hash needs a content floor to resolve) — never shown to players.
   */
  contentVersion: number;
  /** Event-time epoch ms the snapshot was taken (never wall clock). */
  recordedAt: number;
  /** What triggered the capture. Display-only; excluded from ranking. */
  reason: 'molt' | 'evolution' | 'rebirth';
}

/**
 * Up to {@link MAX_DEX_RECORDS} historical snapshots for one species, ranked
 * best-first (grade desc, then stat total desc). The source of truth for the Dex
 * detail view; the Archive view derives its best-per-species rows from each
 * record's `top[0]`.
 */
export interface DexRecord {
  speciesId: string;
  /** Ranked best-first; length 1..MAX_DEX_RECORDS. */
  top: DexSnapshot[];
}

export interface AdapterBaseline {
  /** Rolling mean essence per active window, the self-normalization basis. */
  meanWindowTokens: number;
  windowsObserved: number;
}

export interface GameState {
  schemaVersion: number;
  pet: PetState;
  /** Species ids ever raised (Dex 'owned'). */
  dexOwned: string[];
  archive: ArchiveRecord[];
  /**
   * Per-species record store (top-3 snapshots each). Source of truth for the Dex
   * detail view; the Archive view derives best-per-species from each record's
   * `top[0]`. Defaults to [] for pre-v3 saves (the cli store back-fills it from
   * `archive` on load).
   */
  dexRecords: DexRecord[];
  achievementsEarned: Record<string, number /* earnedAt epoch ms */>;
  habitatsUnlocked: string[];
  trinketsUnlocked: string[];
  selectedHabitat: string;
  selectedTrinkets: string[];
  baselines: Record<string /* adapter id */, AdapterBaseline>;
  /** Deterministic RNG state — persisting it keeps replays reproducible. */
  rngState: number;
  /** High-water mark: engine has consumed all events with ts <= this. */
  simulatedTo: number;
  lineage: Array<{ speciesId: string; grade: Grade; generation: number }>;
}

/** Discrete things that happened during an engine advance — drives UI/cutscenes. */
export type GameEffect =
  | { type: 'hatched'; speciesId: string }
  | { type: 'molt'; at: number }
  | { type: 'evolved'; from: string; to: string; stage: Stage }
  | { type: 'trait_gained'; trait: TraitId }
  | { type: 'pattern_locked'; pattern: PatternId }
  | { type: 'gradeshift'; from: Grade; to: Grade; chance: number }
  | { type: 'grade_roll_failed'; grade: Grade; chance: number }
  | { type: 'mutation'; id: string }
  | { type: 'rebirth'; legacyGrade: Grade; newGeneration: number }
  | { type: 'dormant'; entered: boolean }
  | { type: 'achievement'; id: string }
  | { type: 'habitat_unlocked'; id: string }
  | { type: 'trinket_unlocked'; id: string }
  | { type: 'archive_record'; record: ArchiveRecord }
  | { type: 'dex_record'; snapshot: DexSnapshot };

// ---------------------------------------------------------------------------
// Engine API
// ---------------------------------------------------------------------------

export interface EngineConfig {
  adapters: AdapterConfig[];
  /** The pet-global cycle clock (molt windows + weekly rebirth). */
  cycle: CycleConfig;
  /**
   * Optional epoch-ms instant the pet starts living from on a fresh `tt init`.
   * When present, `initialState` seeds `simulatedTo` and `pet.hatchedAt` to it so
   * the Calibration Egg plays normally from day one instead of being parked in
   * the future at the week anchor. Omit to keep the legacy anchor-derived behavior
   * (existing savefiles/tests are unaffected).
   */
  startAt?: number;
  /**
   * Per-install salt (uint32) that deterministically picks a non-home House when
   * the hatch bias roll leaves home (see `ContentPack.houseBias`). Stable per
   * install, so a player's lineage spreads consistently. Cosmetic only — feeds
   * only `pet.house`, never stats/grades/speed (invariant 3). Omit ⇒ pure
   * model-derived House (legacy behavior; existing saves/tests unaffected). The
   * pick is a pure function of the salt — it does NOT consume the molt RNG, so
   * existing pets' grade/trait/mutation streams stay byte-identical (invariant 5).
   */
  salt?: number;
}

export interface Engine {
  /** Feed normalized usage events (any order; engine sorts/deduplicates). */
  ingest(events: UsageEvent[]): void;
  /**
   * Run the simulation forward to `now` (epoch ms): derive cycle events from
   * ingested usage, fire molts/rebirths, return everything that happened.
   * Deterministic: same saved state + same events + same `now` = same result.
   */
  advanceTo(now: number): GameEffect[];
  /**
   * One-time catch-up repair, run once on load BEFORE `advanceTo`. If the pet's
   * current life began before the most recent weekly boundary and the sim clock
   * already slipped past it without rebirthing (a future `weekAnchor` had frozen
   * rebirth), fire that rebirth now — archiving the pet and starting a fresh egg
   * for the current week. Idempotent and side-effect-free on healthy saves.
   */
  reconcile(now: number): GameEffect[];
  state(): GameState;
  /**
   * The ingested events whose containing 5-h window has NOT yet closed by the
   * last `advanceTo(now)` — the open-window buffer the caller must persist and
   * re-feed next run so events in an unclosed window are never lost.
   */
  pendingEvents(): UsageEvent[];
  /**
   * Establish per-adapter normalization baselines from the already-ingested
   * backfill history, treating windows closed before `now` as observed without
   * replaying their molts. Used once by `tt init`; clears `pet.calibrating` once
   * a full week of windows exists.
   */
  seedBaselines(now: number): void;
  /**
   * Equip a habitat as the pet's active backdrop (a player action, not a cycle
   * event — deterministic, no RNG). Pass '' to clear. An id the player hasn't
   * unlocked is ignored.
   */
  setSelectedHabitat(id: string): void;
  /**
   * Set the pet's active trinkets (a player action). Ids the player hasn't
   * unlocked are dropped; pass [] to clear.
   */
  setSelectedTrinkets(ids: string[]): void;
  /** Completion meter, 0..100 with per-page breakdown. */
  completion(): {
    overall: number;
    dex: number;
    achievements: number;
    habitats: number;
    trinkets: number;
  };
}

// ---------------------------------------------------------------------------
// User config (~/.tokentamers/config.json)
// ---------------------------------------------------------------------------

export interface UserConfig {
  schemaVersion: number;
  /** The pet-global cycle clock; chosen once at `tt init`. */
  cycle: CycleConfig;
  adapters: AdapterConfig[];
  render?: { fps?: number; color?: 'truecolor' | '256' | '8' | 'none' };
  /**
   * Per-install salt (uint32) generated once at `tt init` and back-filled for
   * pre-existing configs on load. Drives the cosmetic non-home House pick at
   * hatch (see `EngineConfig.salt` / `ContentPack.houseBias`). Cosmetic only.
   */
  salt?: number;
  /**
   * The player's Tamer handle, stamped into every DNA code this install breeds
   * (the maker's-mark) and shown on the Battle VS screen. Optional like `salt` —
   * absent on a pre-tamer install (renders "Anonymous Tamer"). Cosmetic/identity
   * only; never affects mechanics (invariant 3).
   */
  tamer?: string;
  /** The earned title the player chose to wear, '' / absent for none. */
  tamerTitle?: string;
}

// ---------------------------------------------------------------------------
// User settings (~/.tokentamers/settings.json)
// ---------------------------------------------------------------------------

/** Color preference; 'auto' = enable when stdout is a TTY. */
export type ColorPreference = 'auto' | 'truecolor' | '256' | '8' | 'none';

/**
 * Sub-cell sprite density preference. `auto` (default) = probe the terminal at
 * launch and pick the richest supported rung; otherwise force a rung. octant
 * (Unicode 16, 2×4) is the art-direction target; sextant (Unicode 13, 2×3) is the
 * broadly-supported middle; half (1×2) is the universal fallback.
 */
export type SubcellPreference = 'auto' | 'octant' | 'sextant' | 'half';

/**
 * User-owned preferences, separate from generated game state. This is the
 * file-based home for everything Token Tamers used to read from environment
 * variables (NO_COLOR, CLAUDE_CONFIG_DIR, OPENCODE_DATA_DIR, XDG_*): the cli
 * reads it and threads the values down, so adapters and core never touch
 * `process.env`. Hand-editable; absent file ⇒ all defaults.
 */
/**
 * Opt-in update behavior. `off` (the default) = the game makes ZERO network
 * calls — the offline pledge is fully intact. `notify` = check GitHub Releases
 * ~once a day and show a banner. `auto` = notify + self-replace the standalone
 * binary on next launch. The ONLY sanctioned network surface lives in
 * `apps/cli/src/services/updater`; it is outbound-read-only and sends nothing.
 */
export type UpdateMode = 'off' | 'notify' | 'auto';

export interface SettingsFile {
  schemaVersion: number;
  /** ANSI color preference (default 'auto'). The `--no-color` flag always wins. */
  color: ColorPreference;
  /** Sub-cell sprite density (default 'auto' — probe the terminal). See {@link SubcellPreference}. */
  subcell?: SubcellPreference;
  /**
   * Override scan roots per adapter id, used at detection time (`tt init`).
   * Empty/absent ⇒ each adapter's built-in default locations. Replaces the
   * former CLAUDE_CONFIG_DIR / OPENCODE_DATA_DIR / XDG_* env overrides.
   */
  adapterRoots: Record<string, string[]>;
  /** Opt-in update mode (default `off`). See {@link UpdateMode}. */
  update?: { mode: UpdateMode };
}
