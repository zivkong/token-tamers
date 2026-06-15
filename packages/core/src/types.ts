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

export type CyclePolicyKind = 'dynamic' | 'static';

export interface AdapterConfig {
  provider: string;
  /** Data roots this adapter scans. */
  paths: string[];
  plan: 'subscription' | 'api';
  cyclePolicy: CyclePolicyKind;
  /** Epoch ms of the week anchor (static policy); Monday 00:00 local by convention. */
  weekAnchor: number;
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
  /** Content revision this entry first shipped in (omitted = 1). */
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
  flavor?: string;
}

export interface TraitDef {
  /** Content revision this entry first shipped in (omitted = 1). */
  since?: number;
  id: TraitId;
  name: string;
  description: string;
}

export interface PatternDef {
  /** Content revision this entry first shipped in (omitted = 1). */
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
  /** Content revision this entry first shipped in (omitted = 1). */
  since?: number;
  id: string;
  name: string;
  description: string;
  condition: AchievementCondition;
  reward?: AchievementReward;
}

export interface HabitatDef {
  /** Content revision this entry first shipped in (omitted = 1). */
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
  /** Content revision this entry first shipped in (omitted = 1). */
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
  /** JSON shape version — bumps only on a breaking schema change (loader migrates forward). */
  schemaVersion: number;
  /**
   * Monotonic content revision, bumped once per content release. Hashes embed it
   * as content_min; Archive records store it. The content tree itself is ONE
   * additive registry (packages/content/content/) — never versioned folders.
   */
  revision: number;
  models: ModelRule[];
  species: SpeciesDef[];
  traits: TraitDef[];
  patterns: PatternDef[];
  achievements: AchievementDef[];
  habitats: HabitatDef[];
  trinkets: TrinketDef[];
  sprites: SpriteDef[];
  /** Total Dex size this pack advertises (drives '???' rows + completion %). */
  dexTotal: number;
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
  /** Content pack revision at capture (the DNA hash's content_min floor). */
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
  /**
   * Optional epoch-ms instant the pet starts living from on a fresh `tt init`.
   * When present, `initialState` seeds `simulatedTo` and `pet.hatchedAt` to it so
   * the Calibration Egg plays normally from day one instead of being parked in
   * the future at the week anchor. Omit to keep the legacy anchor-derived behavior
   * (existing savefiles/tests are unaffected).
   */
  startAt?: number;
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
  adapters: AdapterConfig[];
  render?: { fps?: number; color?: 'truecolor' | '256' | '8' | 'none' };
}

// ---------------------------------------------------------------------------
// User settings (~/.tokentamers/settings.json)
// ---------------------------------------------------------------------------

/** Color preference; 'auto' = enable when stdout is a TTY. */
export type ColorPreference = 'auto' | 'truecolor' | '256' | '8' | 'none';

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
  /**
   * Override scan roots per adapter id, used at detection time (`tt init`).
   * Empty/absent ⇒ each adapter's built-in default locations. Replaces the
   * former CLAUDE_CONFIG_DIR / OPENCODE_DATA_DIR / XDG_* env overrides.
   */
  adapterRoots: Record<string, string[]>;
  /** Opt-in update mode (default `off`). See {@link UpdateMode}. */
  update?: { mode: UpdateMode };
}
