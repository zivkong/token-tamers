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

import { deriveCycleEvents, eggHatchMolts, unconsumedEvents } from '../cycle';
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
} from '../evaluation';
import { chance, createRng, nextInt, type Rng } from '../helpers/rng';
import {
  GRADE_ORDER,
  STAGE_ORDER,
  type AchievementDef,
  type ArchiveRecord,
  type ContentPack,
  type CycleEvent,
  type Engine,
  type EngineConfig,
  type GameEffect,
  type GameState,
  type Grade,
  type House,
  type MoltEvent,
  type PetState,
  type RebirthEvent,
  type RhythmVariant,
  type SpeciesDef,
  type UsageEvent,
} from '../types';
import { achievementConditionMet, patternSatisfied } from './achievements';
import { hasFullWeekBaseline, seedBaselinesFromHistory, updateBaseline } from './baseline';
import { consistencyBand, pickBranch, type BranchInputs } from './branches';
import { computeCompletion } from './completion';
import {
  A_TO_S_CAP,
  GRADE_BASE,
  INHERIT_BASE,
  INHERIT_CAP,
  INHERIT_PER_TIER,
  MAX_TRAIT_SLOTS,
  MUTATION_CHANCE,
  MUTATION_IDS,
} from './constants';
import { round4 } from './grades';
import {
  cloneStats,
  matchModelRule,
  scaleInheritedStats,
  statsForSpecies,
  windowEvents,
} from './houses';
import { isStrictlyBetter, scaleStats } from './rebirth';
import { cloneState, freshPet, initialState } from './state';

export { SCHEMA_VERSION } from './constants';
export { hasFullWeekBaseline, seedBaselinesFromHistory } from './baseline';
export { matchModelRule } from './houses';

interface InternalCycleEvent {
  adapter: string;
  event: CycleEvent;
}

class GameEngine implements Engine {
  private readonly pack: ContentPack;
  private readonly config: EngineConfig;
  private state_: GameState;
  private buffer: UsageEvent[] = [];

  constructor(pack: ContentPack, config: EngineConfig, saved?: GameState) {
    this.pack = pack;
    this.config = config;
    this.state_ = saved ? cloneState(saved) : initialState(config);
  }

  ingest(events: UsageEvent[]): void {
    for (const e of events) this.buffer.push(e);
  }

  state(): GameState {
    return cloneState(this.state_);
  }

  advanceTo(now: number): GameEffect[] {
    const effects: GameEffect[] = [];
    const all = [...this.buffer].sort((a, b) => a.ts - b.ts || cmpStr(a.adapter, b.adapter));

    const after = this.state_.simulatedTo;
    const cycles = this.buildCycles(all, after, now);

    const rng = createRng(this.state_.rngState);
    for (const { adapter, event } of cycles) {
      if (event.type === 'molt') {
        this.replayMolt(adapter, event, all, rng, effects);
      } else {
        this.replayRebirth(event, all, effects);
      }
    }
    this.state_.rngState = rng.state >>> 0;
    this.state_.simulatedTo = Math.max(after, now);
    return effects;
  }

  completion() {
    return computeCompletion(this.state_, this.pack);
  }

  pendingEvents(): UsageEvent[] {
    const out: UsageEvent[] = [];
    const now = this.state_.simulatedTo;
    for (const adapter of this.config.adapters) {
      for (const ev of unconsumedEvents(this.buffer, adapter, now)) out.push(ev);
    }
    return out.sort((a, b) => a.ts - b.ts || cmpStr(a.adapter, b.adapter));
  }

  /**
   * Seed per-adapter baselines purely from the ingested backfill history (init).
   * Folds each CLOSED window's essence into the running mean WITHOUT replaying
   * molts (so history establishes normalization without retroactively evolving
   * the pet), then clears the Calibration flag once a full week is observed.
   */
  seedBaselines(now: number): void {
    const seeded = seedBaselinesFromHistory(this.buffer, this.config.adapters, now);
    for (const [adapter, baseline] of Object.entries(seeded)) {
      this.state_.baselines[adapter] = baseline;
    }
    if (!hasFullWeekBaseline(this.state_.baselines)) return;
    this.state_.pet.calibrating = false;
  }

  // --- cycle derivation -----------------------------------------------------

  private buildCycles(
    all: readonly UsageEvent[],
    after: number,
    now: number,
  ): InternalCycleEvent[] {
    const cycles: InternalCycleEvent[] = [];
    for (const adapter of this.config.adapters) {
      const adEvents = all.filter((e) => e.adapter === adapter.provider);
      const derived = deriveCycleEvents(adEvents, adapter, after, now);
      for (const event of derived) cycles.push({ adapter: adapter.provider, event });
      // Additive egg-hatch checkpoints (one per week); each is a no-op unless the
      // pet is still an egg when replayed (see replayMolt). They never touch the
      // normal 5-h window chain, so pending/determinism are unaffected.
      for (const event of eggHatchMolts(adEvents, adapter.weekAnchor, after, now)) {
        cycles.push({ adapter: adapter.provider, event });
      }
    }
    cycles.sort((a, b) => {
      if (a.event.at !== b.event.at) return a.event.at - b.event.at;
      const ta = a.event.type === 'molt' ? 0 : 1;
      const tb = b.event.type === 'molt' ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return cmpStr(a.adapter, b.adapter);
    });
    return cycles;
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
    // An egg-hatch checkpoint only acts on an unhatched egg; once the pet has
    // hatched (this generation) it is a no-op, leaving the normal molt chain and
    // RNG stream untouched.
    if (event.hatch && pet.stage !== 'egg') return;
    const evs = windowEvents(all, adapter, event.windowStart, event.windowEnd);
    const baselineMean = this.state_.baselines[adapter]?.meanWindowTokens ?? 0;
    const signals = computeWindowSignals(evs, event.windowStart, event.windowEnd, baselineMean);

    // A hatch checkpoint hatches the egg and rolls like any molt, but it is a
    // bonus peek at the first 10 min — it must NOT feed diet or the normalization
    // baseline (those come only from the real 5-h windows), or it would double-
    // count the overlap and skew normalization.
    const isHatch = event.hatch === true;
    const committedThisMolt = pet.stage === 'egg';
    if (committedThisMolt) {
      this.commitHouse(pet, evs, effects);
    }

    pet.moltCount += 1;
    if (!isHatch) this.accumulateDiet(pet, evs, baselineMean);

    if (!committedThisMolt) {
      this.progressStage(pet, signals, rng, effects);
    }

    this.rollTrait(pet, signals, rng, effects);
    this.checkPatterns(pet, effects);
    this.applyRhythmVariant(pet, signals);
    this.rollMutation(pet, rng, effects);
    this.rollGrade(pet, signals, rng, effects);

    effects.push({ type: 'molt', at: event.at });
    if (!isHatch) updateBaseline(this.state_, adapter, signals.totalEssence);
    this.evaluateAchievements(event.at, effects);
  }

  private commitHouse(pet: PetState, evs: readonly UsageEvent[], effects: GameEffect[]): void {
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
    const candidates = this.pack.species
      .filter((sp) => sp.house === house && sp.stage === 'sprite')
      .sort((a, b) => a.num - b.num);
    if (candidates[0]) return candidates[0];
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
    if (!species || species.evolvesTo.length === 0) return;

    const rhythm: RhythmKind = classifyRhythm(signals);
    const traitClass: TraitClass = dominantTraitClass(pet.traits);
    const consistency = consistencyBand(signals.essenceRatio);
    const arc = pet.moltCount <= 4 ? 'early' : 'late';

    const inputs: BranchInputs = { rhythm, traitClass, consistency, arc };
    const chosen = pickBranch(species.evolvesTo, rng, inputs);
    if (!chosen) return;
    const target = this.speciesById(chosen);
    if (!target) return;

    const from = pet.speciesId;
    pet.speciesId = target.id;
    pet.stage = target.stage;
    pet.stats = scaleInheritedStats(statsForSpecies(target), pet);
    this.ownSpecies(target.id);
    effects.push({ type: 'evolved', from, to: target.id, stage: target.stage });
  }

  private rollTrait(pet: PetState, signals: WindowSignals, rng: Rng, effects: GameEffect[]): void {
    if (pet.traits.length >= MAX_TRAIT_SLOTS) {
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

  private rollMutation(pet: PetState, rng: Rng, effects: GameEffect[]): void {
    if (chance(rng, MUTATION_CHANCE)) {
      const id = MUTATION_IDS[nextInt(rng, MUTATION_IDS.length)]!;
      if (!pet.mutations.includes(id)) pet.mutations.push(id);
      effects.push({ type: 'mutation', id });
    }
  }

  private rollGrade(pet: PetState, signals: WindowSignals, rng: Rng, effects: GameEffect[]): void {
    const idx = GRADE_ORDER.indexOf(pet.grade);
    if (idx >= GRADE_ORDER.length - 1) {
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
      pet.grade = to as Grade;
      effects.push({ type: 'gradeshift', from, to: to as Grade, chance: round4(p) });
    } else {
      effects.push({ type: 'grade_roll_failed', grade: from, chance: round4(p) });
    }
  }

  // --- rebirth --------------------------------------------------------------

  private replayRebirth(
    event: RebirthEvent,
    all: readonly UsageEvent[],
    effects: GameEffect[],
  ): void {
    const pet = this.state_.pet;
    const legacyGrade = pet.grade;

    this.state_.lineage.push({
      speciesId: pet.speciesId,
      grade: pet.grade,
      generation: pet.generation,
    });

    const record: ArchiveRecord = {
      speciesId: pet.speciesId,
      grade: pet.grade,
      stats: cloneStats(pet.stats),
      generation: pet.generation,
      contentVersion: this.pack.revision,
      recordedAt: event.at,
    };
    if (this.tryArchive(record)) {
      effects.push({ type: 'archive_record', record });
    }

    const reachedTier = STAGE_ORDER.indexOf(pet.stage);
    const carryFrac = Math.min(INHERIT_CAP, INHERIT_BASE + reachedTier * INHERIT_PER_TIER);
    const carriedStats = scaleStats(pet.stats, carryFrac);

    const weekEvs = all.filter((e) => e.ts >= event.weekStart && e.ts < event.weekEnd);
    const dormant = weekEvs.length === 0;
    const calibrating = !hasFullWeekBaseline(this.state_.baselines);

    const newGen = pet.generation + 1;
    const next = freshPet(newGen, event.at, calibrating);
    next.dormant = dormant;
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
  }

  private achievementMet(def: AchievementDef): boolean {
    return achievementConditionMet(def, this.state_, {
      dexTotal: this.pack.dexTotal,
      lookupSpecies: (id) => this.speciesById(id),
    });
  }

  // --- helpers --------------------------------------------------------------

  private speciesById(id: string): SpeciesDef | undefined {
    return this.pack.species.find((sp) => sp.id === id);
  }

  private ownSpecies(id: string): void {
    if (!this.state_.dexOwned.includes(id)) this.state_.dexOwned.push(id);
  }
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Construct an Engine. `saved` resumes exactly from a prior `state()` snapshot;
 * the caller must re-feed the full event history via `ingest` before advancing
 * for replay-from-snapshot to equal replay-from-scratch.
 */
export function createEngine(pack: ContentPack, config: EngineConfig, saved?: GameState): Engine {
  return new GameEngine(pack, config, saved);
}
