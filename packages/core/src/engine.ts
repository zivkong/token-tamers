/**
 * The deterministic game engine (design §5, §6, §8, §12, §14, §15).
 *
 * createEngine(pack, config, saved?) returns an Engine. advanceTo(now):
 *  1. derive cycle events (molts + rebirths) from buffered usage up to `now`,
 *  2. replay each in order, mutating GameState through the seeded RNG,
 *  3. return the GameEffects that occurred.
 *
 * Determinism contract: same saved state + same events + same `now` => identical
 * results. Replay from scratch == resume from any snapshot. All randomness is the
 * seeded RNG whose state lives in GameState.rngState; all time is event/anchor
 * data. No wall clock, no Math.random, no I/O, no imports outside core.
 */

import { deriveCycleEvents, WEEK_MS } from './cycle';
import {
  activityModifier,
  classifyRhythm,
  computeWindowSignals,
  dominantTraitClass,
  evaluateTraits,
  eventEssence,
  type RhythmKind,
  type TraitClass,
  type WindowSignals,
} from './molt-eval';
import { chance, createRng, nextInt, pickWeighted, type Rng } from './rng';
import {
  GRADE_ORDER,
  STAGE_ORDER,
  type AchievementCondition,
  type AchievementDef,
  type AdapterBaseline,
  type ArchiveRecord,
  type BranchCondition,
  type ContentPack,
  type CycleEvent,
  type Engine,
  type EngineConfig,
  type GameEffect,
  type GameState,
  type Grade,
  type House,
  type ModelRule,
  type MoltEvent,
  type PatternDef,
  type PetState,
  type RebirthEvent,
  type RhythmVariant,
  type SpeciesDef,
  type Stage,
  type Stats,
  type TraitId,
  type UsageEvent,
} from './types';

export const SCHEMA_VERSION = 1;

// Grade-up base rates (design §12), content-tunable but fixed here for MVP.
const GRADE_BASE: Partial<Record<Grade, number>> = { C: 0.25, B: 0.1, A: 0.03 };
const A_TO_S_CAP = 0.06;
const MUTATION_CHANCE = 0.05;
const MAX_TRAIT_SLOTS = 5;
const INHERIT_BASE = 0.3;
const INHERIT_PER_TIER = 0.1;
const INHERIT_CAP = 0.7;
const STAGE_STAT_BUDGET = 240; // equal total budget per stage, scaled by weights

const MUTATION_IDS = ['palette-shift', 'offline-trait', 'stat-swap'] as const;

interface InternalCycleEvent {
  adapter: string;
  event: CycleEvent;
}

/** A window's events bucketed by adapter, used during molt replay. */
function windowEvents(
  events: readonly UsageEvent[],
  adapter: string,
  windowStart: number,
  windowEnd: number,
): UsageEvent[] {
  return events.filter((e) => e.adapter === adapter && e.ts >= windowStart && e.ts < windowEnd);
}

function cloneStats(s: Stats): Stats {
  return { pwr: s.pwr, spd: s.spd, wis: s.wis, grt: s.grt };
}

/** Distribute the stage budget across stats proportional to species weights. */
function statsForSpecies(species: SpeciesDef): Stats {
  const w = species.statWeights;
  const total = w.pwr + w.spd + w.wis + w.grt || 1;
  const scale = STAGE_STAT_BUDGET / total;
  return {
    pwr: Math.round(w.pwr * scale),
    spd: Math.round(w.spd * scale),
    wis: Math.round(w.wis * scale),
    grt: Math.round(w.grt * scale),
  };
}

/** First-match-wins model->House/gene resolution with '*' wildcard support. */
export function matchModelRule(rules: readonly ModelRule[], modelId: string): ModelRule | null {
  for (const rule of rules) {
    if (globMatch(rule.pattern, modelId)) return rule;
  }
  return null;
}

/** Minimal glob: '*' matches any run of chars. Anchored full-string match. */
function globMatch(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  // Build a regex from the glob, escaping regex metachars except '*'.
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

function freshPet(generation: number, hatchedAt: number, calibrating: boolean): PetState {
  return {
    speciesId: 'mote',
    stage: 'egg',
    house: 'wild',
    grade: 'C',
    traits: [],
    pattern: null,
    rhythmVariant: null,
    stats: { pwr: 0, spd: 0, wis: 0, grt: 0 },
    moltCount: 0,
    generation,
    hatchedAt,
    dormant: false,
    calibrating,
    dietGenes: {},
    mutations: [],
    lastGradeRoll: null,
  };
}

function initialState(config: EngineConfig): GameState {
  const firstAnchor = config.adapters[0]?.weekAnchor ?? 0;
  return {
    schemaVersion: SCHEMA_VERSION,
    pet: freshPet(1, firstAnchor, true),
    dexOwned: [],
    archive: [],
    achievementsEarned: {},
    habitatsUnlocked: [],
    trinketsUnlocked: [],
    selectedHabitat: '',
    selectedTrinkets: [],
    baselines: {},
    rngState: (firstAnchor ^ 0x9e3779b9) >>> 0,
    simulatedTo: firstAnchor === 0 ? 0 : firstAnchor - 1,
    lineage: [],
  };
}

class GameEngine implements Engine {
  private readonly pack: ContentPack;
  private readonly config: EngineConfig;
  private state_: GameState;
  private buffer: UsageEvent[] = [];

  constructor(pack: ContentPack, config: EngineConfig, saved?: GameState) {
    this.pack = pack;
    this.config = config;
    this.state_ = saved ? structuredCloneState(saved) : initialState(config);
  }

  ingest(events: UsageEvent[]): void {
    for (const e of events) this.buffer.push(e);
  }

  state(): GameState {
    return structuredCloneState(this.state_);
  }

  advanceTo(now: number): GameEffect[] {
    const effects: GameEffect[] = [];
    // Merge buffer with nothing persisted (events are not stored in state); the
    // caller re-feeds the full event history on resume, which is what keeps
    // replay-from-scratch == resume-from-snapshot.
    const all = [...this.buffer].sort((a, b) => a.ts - b.ts || cmpStr(a.adapter, b.adapter));

    // Derive cycle events per adapter, strictly after simulatedTo and <= now.
    const after = this.state_.simulatedTo;
    const cycles: InternalCycleEvent[] = [];
    for (const adapter of this.config.adapters) {
      const adEvents = all.filter((e) => e.adapter === adapter.provider);
      const derived = deriveCycleEvents(adEvents, adapter, after, now);
      for (const event of derived) cycles.push({ adapter: adapter.provider, event });
    }
    // Global ordering: by close time, molt-before-rebirth, then adapter id.
    cycles.sort((a, b) => {
      if (a.event.at !== b.event.at) return a.event.at - b.event.at;
      const ta = a.event.type === 'molt' ? 0 : 1;
      const tb = b.event.type === 'molt' ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return cmpStr(a.adapter, b.adapter);
    });

    const rng = createRng(this.state_.rngState);
    for (const { adapter, event } of cycles) {
      if (event.type === 'molt') {
        this.replayMolt(adapter, event, all, rng, effects);
      } else {
        this.replayRebirth(event, all, rng, effects);
      }
    }
    this.state_.rngState = rng.state >>> 0;
    this.state_.simulatedTo = Math.max(after, now);
    return effects;
  }

  completion(): {
    overall: number;
    dex: number;
    achievements: number;
    habitats: number;
    trinkets: number;
  } {
    const s = this.state_;
    const dexTotal = this.pack.dexTotal || 1;
    const achTotal = this.pack.achievements.length || 1;
    const habTotal = this.pack.habitats.length || 1;
    const trkTotal = this.pack.trinkets.length || 1;

    const dex = clamp01(s.dexOwned.length / dexTotal);
    const achievements = clamp01(Object.keys(s.achievementsEarned).length / achTotal);
    const habitats = clamp01(s.habitatsUnlocked.length / habTotal);
    const trinkets = clamp01(s.trinketsUnlocked.length / trkTotal);

    const overall = dex * 0.4 + achievements * 0.4 + habitats * 0.1 + trinkets * 0.1;
    return {
      overall: round1(overall * 100),
      dex: round1(dex * 100),
      achievements: round1(achievements * 100),
      habitats: round1(habitats * 100),
      trinkets: round1(trinkets * 100),
    };
  }

  // --- molt -----------------------------------------------------------------

  private replayMolt(
    adapter: string,
    event: MoltEvent,
    all: readonly UsageEvent[],
    rng: Rng,
    effects: GameEffect[],
  ): void {
    const pet = this.state_.pet;
    const evs = windowEvents(all, adapter, event.windowStart, event.windowEnd);
    const baseline = this.state_.baselines[adapter];
    const baselineMean = baseline?.meanWindowTokens ?? 0;
    const signals = computeWindowSignals(evs, event.windowStart, event.windowEnd, baselineMean);

    // First molt commits the Mote to a House by the window's dominant gene.
    // The egg->sprite commitment IS this molt's stage progression, so we skip
    // the branch-based progression below on the committing molt.
    const committedThisMolt = pet.stage === 'egg';
    if (committedThisMolt) {
      this.commitHouse(pet, evs, effects);
    }

    pet.moltCount += 1;

    // Accumulate diet genes (normalized essence per gene).
    this.accumulateDiet(pet, evs, baselineMean);

    // Stage progression via species evolvesTo branch conditions (one step max).
    if (!committedThisMolt) {
      this.progressStage(pet, signals, rng, effects);
    }

    // One trait roll per molt (max 5 slots).
    this.rollTrait(pet, signals, rng, effects);

    // Pattern locking (re-checked each molt; "final" semantics handled at week's
    // last molt by virtue of replay order — the last molt before a rebirth wins).
    this.checkPatterns(pet, effects);

    // Rhythm variant (palette/pose flair from Evolved onward).
    this.applyRhythmVariant(pet, signals);

    // ~5% mutation per molt.
    if (chance(rng, MUTATION_CHANCE)) {
      const id = MUTATION_IDS[nextInt(rng, MUTATION_IDS.length)]!;
      if (!pet.mutations.includes(id)) pet.mutations.push(id);
      effects.push({ type: 'mutation', id });
    }

    // Grade roll (monotonic; transparency record).
    this.rollGrade(pet, signals, rng, effects);

    effects.push({ type: 'molt', at: event.at });

    // Update baseline AFTER using it for normalization this window.
    this.updateBaseline(adapter, signals.totalEssence);

    // Achievements re-evaluated after every molt.
    this.evaluateAchievements(event.at, effects);
  }

  private commitHouse(pet: PetState, evs: readonly UsageEvent[], effects: GameEffect[]): void {
    // Dominant gene = the model rule matched by the plurality of essence.
    const essenceByGene = new Map<string, number>();
    const houseByGene = new Map<string, House>();
    let wildEssence = 0;
    for (const ev of evs) {
      const rule = matchModelRule(this.pack.models, ev.modelId);
      const ess = eventEssence(ev) || 1;
      if (rule) {
        essenceByGene.set(rule.geneId, (essenceByGene.get(rule.geneId) ?? 0) + ess);
        houseByGene.set(rule.geneId, rule.house);
      } else {
        wildEssence += ess;
      }
    }
    let bestGene = '';
    let bestEss = 0;
    for (const [gene, ess] of [...essenceByGene.entries()].sort((a, b) =>
      a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    )) {
      if (ess > bestEss) {
        bestEss = ess;
        bestGene = gene;
      }
    }
    pet.house = bestGene && bestEss >= wildEssence ? houseByGene.get(bestGene)! : 'wild';

    // Commit the Mote to the House's sprite-stage species.
    const next = this.firstSpeciesForHouse(pet.house);
    if (next) {
      pet.speciesId = next.id;
      pet.stage = next.stage;
      pet.stats = scaleInheritedStats(statsForSpecies(next), pet);
      this.ownSpecies(next.id);
    }
    effects.push({ type: 'hatched', speciesId: pet.speciesId });
  }

  private firstSpeciesForHouse(house: House): SpeciesDef | undefined {
    // The sprite-stage species of the matching House (lowest dex num at sprite).
    const candidates = this.pack.species
      .filter((sp) => sp.house === house && sp.stage === 'sprite')
      .sort((a, b) => a.num - b.num);
    if (candidates[0]) return candidates[0];
    // Fallback: any sprite-stage species (keeps wild deterministic).
    return this.pack.species.filter((sp) => sp.stage === 'sprite').sort((a, b) => a.num - b.num)[0];
  }

  private accumulateDiet(pet: PetState, evs: readonly UsageEvent[], baselineMean: number): void {
    const denom = baselineMean > 0 ? baselineMean : 1;
    for (const ev of evs) {
      const rule = matchModelRule(this.pack.models, ev.modelId);
      const gene = rule ? rule.geneId : `wild:${ev.modelId}`;
      pet.dietGenes[gene] = (pet.dietGenes[gene] ?? 0) + eventEssence(ev) / denom;
    }
  }

  private progressStage(
    pet: PetState,
    signals: WindowSignals,
    rng: Rng,
    effects: GameEffect[],
  ): void {
    const species = this.speciesById(pet.speciesId);
    if (!species || species.evolvesTo.length === 0) return; // apex or unknown

    // Molts 1..2 guarantee progression (design §6); for MVP every molt that has
    // any branch progresses, so the guarantee holds and later molts also branch.
    const traits = pet.traits;
    const rhythm = classifyRhythm(signals);
    const traitClass = dominantTraitClass(traits);
    const consistency = consistencyBand(signals.essenceRatio);
    const arc = pet.moltCount <= 4 ? 'early' : 'late';

    const chosen = pickBranch(species.evolvesTo, rng, {
      rhythm,
      traitClass,
      consistency,
      arc,
    });
    if (!chosen) return;
    const target = this.speciesById(chosen);
    if (!target) return;

    const from = pet.speciesId;
    pet.speciesId = target.id;
    pet.stage = target.stage;
    // Re-budget stats for the new stage, carrying inheritance bonus.
    pet.stats = scaleInheritedStats(statsForSpecies(target), pet);
    this.ownSpecies(target.id);
    effects.push({ type: 'evolved', from, to: target.id, stage: target.stage });
  }

  private rollTrait(pet: PetState, signals: WindowSignals, rng: Rng, effects: GameEffect[]): void {
    if (pet.traits.length >= MAX_TRAIT_SLOTS) {
      // Still consume a draw to keep the stream stable regardless of slot count.
      nextInt(rng, 1);
      return;
    }
    const triggered = evaluateTraits(signals).filter((t) => !pet.traits.includes(t));
    if (triggered.length === 0) {
      nextInt(rng, 1);
      return;
    }
    const pick = triggered[nextInt(rng, triggered.length)]!;
    pet.traits.push(pick);
    effects.push({ type: 'trait_gained', trait: pick });
  }

  private checkPatterns(pet: PetState, effects: GameEffect[]): void {
    if (pet.pattern) return;
    for (const def of this.pack.patterns) {
      if (patternSatisfied(def, pet.traits)) {
        pet.pattern = def.id;
        effects.push({ type: 'pattern_locked', pattern: def.id });
        return;
      }
    }
  }

  private applyRhythmVariant(pet: PetState, signals: WindowSignals): void {
    const stageIdx = STAGE_ORDER.indexOf(pet.stage);
    if (stageIdx < STAGE_ORDER.indexOf('evolved')) return;
    let variant: RhythmVariant;
    if (signals.nightFraction > 0.5) variant = 'nocturne';
    else if (signals.gapCv >= 1.2) variant = 'burnout';
    else variant = 'disciplined';
    pet.rhythmVariant = variant;
  }

  private rollGrade(pet: PetState, signals: WindowSignals, rng: Rng, effects: GameEffect[]): void {
    const idx = GRADE_ORDER.indexOf(pet.grade);
    if (idx >= GRADE_ORDER.length - 1) {
      // Already at S; consume a draw to keep the stream stable, record nothing.
      chance(rng, 0);
      pet.lastGradeRoll = null;
      return;
    }
    const from = pet.grade;
    const to = GRADE_ORDER[idx + 1]!;
    const base = GRADE_BASE[from] ?? 0;
    const mod = activityModifier(signals, pet.traits);
    let p = base * mod;
    if (from === 'A') p = Math.min(p, A_TO_S_CAP);
    p = Math.max(0, Math.min(1, p));

    const succeeded = chance(rng, p);
    pet.lastGradeRoll = { from, to, chance: round4(p), succeeded };
    if (succeeded) {
      pet.grade = to; // monotonic — only ever increases
      effects.push({ type: 'gradeshift', from, to, chance: round4(p) });
    } else {
      effects.push({ type: 'grade_roll_failed', grade: from, chance: round4(p) });
    }
  }

  private updateBaseline(adapter: string, windowEssence: number): void {
    const prev = this.state_.baselines[adapter];
    if (!prev) {
      this.state_.baselines[adapter] = {
        meanWindowTokens: windowEssence,
        windowsObserved: 1,
      };
      return;
    }
    const n = prev.windowsObserved + 1;
    const mean = prev.meanWindowTokens + (windowEssence - prev.meanWindowTokens) / n;
    const next: AdapterBaseline = { meanWindowTokens: mean, windowsObserved: n };
    this.state_.baselines[adapter] = next;
  }

  // --- rebirth --------------------------------------------------------------

  private replayRebirth(
    event: RebirthEvent,
    all: readonly UsageEvent[],
    rng: Rng,
    effects: GameEffect[],
  ): void {
    const pet = this.state_.pet;
    const legacyGrade = pet.grade;

    // Lineage entry for the life that just ended.
    this.state_.lineage.push({
      speciesId: pet.speciesId,
      grade: pet.grade,
      generation: pet.generation,
    });

    // Archive record (best-per-species: grade first, stat-total tiebreak).
    const record: ArchiveRecord = {
      speciesId: pet.speciesId,
      grade: pet.grade,
      stats: cloneStats(pet.stats),
      generation: pet.generation,
      contentVersion: this.pack.version,
      recordedAt: event.at,
    };
    if (this.tryArchive(record)) {
      effects.push({ type: 'archive_record', record });
    }

    // Inheritance: stat carry-over 30% + 10% per stage tier reached, cap 70%.
    const reachedTier = STAGE_ORDER.indexOf(pet.stage);
    const carryFrac = Math.min(INHERIT_CAP, INHERIT_BASE + reachedTier * INHERIT_PER_TIER);
    const carriedStats = scaleStats(pet.stats, carryFrac);

    // Dormancy: a week with zero usage in the just-ended week.
    const weekEvents = all.filter((e) => e.ts >= event.weekStart && e.ts < event.weekEnd);
    const dormant = weekEvents.length === 0;

    // Calibration ends once a full week of baseline exists.
    const calibrating = !this.hasFullWeekBaseline();

    const newGen = pet.generation + 1;
    const next = freshPet(newGen, event.at, calibrating);
    next.dormant = dormant;
    // The carried stats become the new egg's per-stat *floor*: they sit on
    // pet.stats until the first molt commits a species, at which point
    // scaleInheritedStats takes max(freshStageBudget, floor). Inheritance never
    // touches grade (always restarts at C) — only stats carry.
    next.stats = carriedStats;
    this.state_.pet = next;

    effects.push({ type: 'rebirth', legacyGrade, newGeneration: newGen });
    if (dormant) effects.push({ type: 'dormant', entered: true });

    this.evaluateAchievements(event.at, effects);
  }

  private tryArchive(record: ArchiveRecord): boolean {
    const idx = this.state_.archive.findIndex((r) => r.speciesId === record.speciesId);
    if (idx < 0) {
      this.state_.archive.push(record);
      return true;
    }
    const existing = this.state_.archive[idx]!;
    if (isStrictlyBetter(record, existing)) {
      this.state_.archive[idx] = record;
      return true;
    }
    return false;
  }

  private hasFullWeekBaseline(): boolean {
    // A "full week" of windows is observed across any adapter. With 5-h windows,
    // a 7-day week is ~33.6 windows; require at least that many cumulatively.
    const windowsPerWeek = Math.ceil(WEEK_MS / (5 * 60 * 60 * 1000));
    let max = 0;
    for (const b of Object.values(this.state_.baselines)) {
      if (b.windowsObserved > max) max = b.windowsObserved;
    }
    return max >= windowsPerWeek;
  }

  // --- achievements ---------------------------------------------------------

  private evaluateAchievements(at: number, effects: GameEffect[]): void {
    for (const def of this.pack.achievements) {
      if (this.state_.achievementsEarned[def.id] !== undefined) continue;
      if (this.achievementMet(def)) {
        this.state_.achievementsEarned[def.id] = at;
        effects.push({ type: 'achievement', id: def.id });
        this.grantReward(def, effects);
      }
    }
  }

  private grantReward(def: AchievementDef, effects: GameEffect[]): void {
    const reward = def.reward;
    if (!reward) return;
    if (reward.kind === 'habitat' && !this.state_.habitatsUnlocked.includes(reward.id)) {
      this.state_.habitatsUnlocked.push(reward.id);
      if (this.state_.selectedHabitat === '') this.state_.selectedHabitat = reward.id;
      effects.push({ type: 'habitat_unlocked', id: reward.id });
    } else if (reward.kind === 'trinket' && !this.state_.trinketsUnlocked.includes(reward.id)) {
      this.state_.trinketsUnlocked.push(reward.id);
      effects.push({ type: 'trinket_unlocked', id: reward.id });
    }
    // 'title' and 'flair' rewards have no GameState/GameEffect channel in v1.
  }

  private achievementMet(def: AchievementDef): boolean {
    const c: AchievementCondition = def.condition;
    const s = this.state_;
    const pet = s.pet;
    switch (c.type) {
      case 'stage_reached':
        // Current pet, or any species ever owned that sits at/above the stage.
        return (
          reachedStage(pet.stage, c.stage) ||
          s.dexOwned.some((id) => {
            const sp = this.speciesById(id);
            return sp ? reachedStage(sp.stage, c.stage) : false;
          })
        );
      case 'grade_reached':
        // Current life, or any archived record at/above the grade.
        return (
          gradeAtLeast(pet.grade, c.grade) || s.archive.some((r) => gradeAtLeast(r.grade, c.grade))
        );
      case 'trait_earned':
        // Count of this trait on the current life (traits are unique per slot,
        // so >=1 distinct; count>1 conditions span lifetimes in M2).
        return pet.traits.filter((t) => t === c.trait).length >= c.count;
      case 'pattern_first':
        return pet.pattern === c.pattern;
      case 'generation':
        return pet.generation >= c.count;
      case 'molt_count_lifetime':
        return pet.moltCount >= c.count;
      case 'dormant_survived':
        return pet.dormant === true;
      case 'house_apex':
        return s.archive.some((r) => {
          const sp = this.speciesById(r.speciesId);
          return sp?.house === c.house && sp.stage === 'apex';
        });
      case 'dex_percent':
        return (s.dexOwned.length / (this.pack.dexTotal || 1)) * 100 >= c.percent;
      case 'distinct_traits_one_life':
        return new Set(pet.traits).size >= c.count;
      default:
        return false;
    }
  }

  // --- helpers --------------------------------------------------------------

  private speciesById(id: string): SpeciesDef | undefined {
    return this.pack.species.find((sp) => sp.id === id);
  }

  private ownSpecies(id: string): void {
    if (!this.state_.dexOwned.includes(id)) this.state_.dexOwned.push(id);
  }
}

// --- module-scope pure helpers ---------------------------------------------

function reachedStage(current: Stage, target: Stage): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(target);
}

function gradeAtLeast(current: Grade, target: Grade): boolean {
  return GRADE_ORDER.indexOf(current) >= GRADE_ORDER.indexOf(target);
}

function isStrictlyBetter(candidate: ArchiveRecord, existing: ArchiveRecord): boolean {
  const cg = GRADE_ORDER.indexOf(candidate.grade);
  const eg = GRADE_ORDER.indexOf(existing.grade);
  if (cg !== eg) return cg > eg;
  return statTotal(candidate.stats) > statTotal(existing.stats);
}

function statTotal(s: Stats): number {
  return s.pwr + s.spd + s.wis + s.grt;
}

function scaleStats(s: Stats, frac: number): Stats {
  return {
    pwr: Math.round(s.pwr * frac),
    spd: Math.round(s.spd * frac),
    wis: Math.round(s.wis * frac),
    grt: Math.round(s.grt * frac),
  };
}

/**
 * Apply the inheritance floor to fresh stage stats: the new pet's stats are the
 * fresh budget, but never below the carried floor (per-stat). The floor lives on
 * the new egg's stats until the first commit; we read it off pet.stats which the
 * rebirth path seeded with the carried values.
 */
function scaleInheritedStats(fresh: Stats, pet: PetState): Stats {
  const floor = pet.stats;
  return {
    pwr: Math.max(fresh.pwr, floor.pwr),
    spd: Math.max(fresh.spd, floor.spd),
    wis: Math.max(fresh.wis, floor.wis),
    grt: Math.max(fresh.grt, floor.grt),
  };
}

function patternSatisfied(def: PatternDef, traits: readonly TraitId[]): boolean {
  if (def.requiresTraits && def.requiresTraits.length > 0) {
    return def.requiresTraits.every((t) => traits.includes(t));
  }
  if (def.minDistinctTraits && def.minDistinctTraits > 0) {
    return new Set(traits).size >= def.minDistinctTraits;
  }
  return false;
}

function consistencyBand(ratio: number): 'low' | 'mid' | 'high' {
  if (ratio < 0.5) return 'low';
  if (ratio < 1.25) return 'mid';
  return 'high';
}

interface BranchInputs {
  rhythm: RhythmKind;
  traitClass: TraitClass;
  consistency: 'low' | 'mid' | 'high';
  arc: 'early' | 'late';
}

/**
 * Choose an evolution branch. Branches whose condition matches the inputs are
 * preferred; among matches the first in declaration order wins. If nothing
 * matches, fall back to a 'default' branch, else a deterministic weighted pick
 * over all branches (one RNG draw, always consumed for stream stability).
 */
function pickBranch(
  branches: readonly { species: string; when: BranchCondition }[],
  rng: Rng,
  inputs: BranchInputs,
): string | null {
  if (branches.length === 0) return null;
  const matches = branches.filter((b) => branchMatches(b.when, inputs));
  // Always consume exactly one draw so the RNG stream is independent of which
  // path is taken (keeps replay determinism robust to data tweaks).
  const idx = pickWeighted(
    rng,
    branches.map(() => 1),
  );
  if (matches.length > 0) {
    // Prefer the most specific matching branch (non-default), first in order.
    const specific = matches.find((b) => b.when.kind !== 'default');
    return (specific ?? matches[0]!).species;
  }
  const def = branches.find((b) => b.when.kind === 'default');
  if (def) return def.species;
  return branches[idx]!.species;
}

function branchMatches(when: BranchCondition, inputs: BranchInputs): boolean {
  switch (when.kind) {
    case 'default':
      return true;
    case 'rhythm':
      return inputs.rhythm === when.value;
    case 'traitClass':
      return inputs.traitClass === when.value;
    case 'consistency':
      return inputs.consistency === when.value;
    case 'arc':
      return inputs.arc === when.value;
    default:
      return false;
  }
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Deep, JSON-safe clone that does not depend on structuredClone availability. */
function structuredCloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}

/**
 * Construct an Engine. `saved` resumes exactly from a prior `state()` snapshot;
 * the caller must re-feed the full event history via `ingest` before advancing
 * for replay-from-snapshot to equal replay-from-scratch.
 */
export function createEngine(pack: ContentPack, config: EngineConfig, saved?: GameState): Engine {
  return new GameEngine(pack, config, saved);
}
