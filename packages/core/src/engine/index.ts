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
  STAGE_ORDER,
  type ArchiveRecord,
  type ContentPack,
  type CycleEvent,
  type DexSnapshot,
  type Engine,
  type EngineConfig,
  type GameEffect,
  type GameState,
  type House,
  type MoltEvent,
  type PetState,
  type RebirthEvent,
  type RhythmVariant,
  type SpeciesDef,
  type UsageEvent,
} from '../types';
import { evaluateAchievements, patternSatisfied } from './achievements';
import {
  baselineMeans,
  foldWindowBaselines,
  hasFullWeekBaseline,
  seedBaselinesFromHistory,
} from './baseline';
import { consistencyBand, pickBranch, type BranchInputs } from './branches';
import { computeCompletion } from './completion';
import { overdueRebirthEvent } from './reconcile';
import {
  INHERIT_BASE,
  INHERIT_CAP,
  INHERIT_PER_TIER,
  MAX_TRAIT_SLOTS,
  MUTATION_CHANCE,
  MUTATION_IDS,
} from './constants';
import { rollGrade } from './grades';
import {
  biasedHouse,
  cloneStats,
  matchModelRule,
  scaleInheritedStats,
  statsForSpecies,
} from './houses';
import { tryCaptureSnapshot } from './dex-records';
import { evolutionGateMet, requiredMaturity } from './maturity';
import { archiveRecord, scaleStats } from './rebirth';
import { petSnapshot } from './snapshot';
import { cloneState, freshPet, initialState } from './state';

export { SCHEMA_VERSION, VITALITY_FULL_TOKENS, VITALITY_MAX_BONUS } from './constants';
export { GRAFT_GRADE_BONUS_CAP, GRAFT_POTENCY, GRAFT_STAT_BOOST_CAP } from './constants';
export { GRADE_STAT_FLOOR, GRADE_STAT_FLOOR_CAP } from './constants';
export { bestSpeciesRecords, snapshotRank, tryCaptureSnapshot } from './dex-records';
export { MAX_DEX_RECORDS, rankBestPerLife, snapshotStrictlyBetter } from './dex-records';
export { graftPotency, graftPotencyTier, type GraftPotency } from './graft';
export { petSnapshot } from './snapshot';
export { gradeOdds, vitalityBonus, type GradeOddsPreview } from './grades';
export { hasFullWeekBaseline, seedBaselinesFromHistory } from './baseline';
export { BATTLE_READY_STAGE, growthProgress, requiredMaturity, stageMature } from './maturity';
export { isBattleReady, isGraftReady, type GrowthProgress } from './maturity';
export { matchModelRule } from './houses';

class GameEngine implements Engine {
  private readonly pack: ContentPack;
  private readonly config: EngineConfig;
  private state_: GameState;
  private buffer: UsageEvent[] = [];

  constructor(pack: ContentPack, config: EngineConfig, saved?: GameState) {
    this.pack = pack;
    this.config = config;
    this.state_ = saved ? cloneState(saved) : initialState(config);
    // Defensive: a resumed snapshot must carry the arrays the engine now reads
    // (`dexRecords` is SCHEMA_VERSION 3). The cli store migrates/back-fills it from
    // `archive` on load; this only guards a snapshot that bypassed that path so
    // `capture()` never dereferences undefined. Pure, deterministic (no back-fill).
    if (!Array.isArray(this.state_.dexRecords)) this.state_.dexRecords = [];
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
    for (const event of cycles) {
      if (event.type === 'molt') {
        this.replayMolt(event, all, rng, effects);
      } else {
        this.replayRebirth(event, all, effects);
      }
    }
    this.state_.rngState = rng.state >>> 0;
    this.state_.simulatedTo = Math.max(after, now);
    return effects;
  }

  /**
   * One-time catch-up repair (see {@link overdueRebirthEvent} for the rule). Run
   * once on load, after `ingest` and before `advanceTo`: rebirths a pet whose sim
   * clock slipped past a weekly boundary while a future `weekAnchor` had rebirth
   * frozen. Idempotent and a no-op on healthy saves.
   */
  reconcile(now: number): GameEffect[] {
    const effects: GameEffect[] = [];
    const all = [...this.buffer].sort((a, b) => a.ts - b.ts || cmpStr(a.adapter, b.adapter));
    const event = overdueRebirthEvent(this.state_, all, this.config.cycle, now);
    if (event) this.replayRebirth(event, all, effects);
    return effects;
  }

  completion() {
    return computeCompletion(this.state_, this.pack);
  }

  setSelectedHabitat(id: string): void {
    if (id !== '' && !this.state_.habitatsUnlocked.includes(id)) return;
    this.state_.selectedHabitat = id;
  }

  setSelectedTrinkets(ids: string[]): void {
    this.state_.selectedTrinkets = ids.filter((id) => this.state_.trinketsUnlocked.includes(id));
  }

  pendingEvents(): UsageEvent[] {
    const now = this.state_.simulatedTo;
    return unconsumedEvents(this.buffer, this.config.cycle, now).sort(
      (a, b) => a.ts - b.ts || cmpStr(a.adapter, b.adapter),
    );
  }

  /**
   * Seed per-adapter baselines purely from the ingested backfill history (init).
   * Folds each CLOSED window's essence into the running mean WITHOUT replaying
   * molts (so history establishes normalization without retroactively evolving
   * the pet), then clears the Calibration flag once a full week is observed.
   */
  seedBaselines(now: number): void {
    const seeded = seedBaselinesFromHistory(
      this.buffer,
      this.config.cycle,
      this.config.adapters,
      now,
    );
    for (const [adapter, baseline] of Object.entries(seeded)) {
      this.state_.baselines[adapter] = baseline;
    }
    if (!hasFullWeekBaseline(this.state_.baselines)) return;
    this.state_.pet.calibrating = false;
  }

  // --- cycle derivation -----------------------------------------------------

  private buildCycles(all: readonly UsageEvent[], after: number, now: number): CycleEvent[] {
    // ONE clock for the pet (design §5): derive molts + rebirths once over the
    // merged stream using the pet-global CycleConfig — never per adapter.
    const cycles: CycleEvent[] = [...deriveCycleEvents(all, this.config.cycle, after, now)];
    // Additive egg-hatch checkpoints (one per week, off ANY adapter's first
    // feeding); each is a no-op unless the pet is still an egg when replayed (see
    // replayMolt). They never touch the normal 5-h window chain, so
    // pending/determinism are unaffected. Floor the search at the generation's
    // placement so the egg hatches off its own first feeding, not history
    // predating it (the first egg is placed mid-week).
    //
    // Only request them while the pet is actually an egg. eggHatchMolts has no
    // `after`/simulatedTo gate (its hatch instant can predate the sim clock for a
    // back-dated reborn egg), so this stage check is what scopes it: an already-
    // hatched pet derives no hatch checkpoint, and a still-egg pet whose clock has
    // overrun the hatch instant gets it back and self-heals on this advance.
    if (this.state_.pet.stage === 'egg') {
      const weekAnchor = this.config.cycle.weekAnchor;
      const hatches = eggHatchMolts(all, weekAnchor, now, this.state_.pet.hatchedAt);
      for (const h of hatches) cycles.push(h);
    }
    cycles.sort((a, b) => {
      if (a.at !== b.at) return a.at - b.at;
      const ta = a.type === 'molt' ? 0 : 1;
      const tb = b.type === 'molt' ? 0 : 1;
      if (ta !== tb) return ta - tb;
      // Among molts at the same instant, a hatch checkpoint sorts after a normal
      // window close (stable, deterministic).
      const ha = a.type === 'molt' && a.hatch ? 1 : 0;
      const hb = b.type === 'molt' && b.hatch ? 1 : 0;
      return ha - hb;
    });
    return cycles;
  }

  // --- molt -----------------------------------------------------------------

  private replayMolt(
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
    // One window covers the WHOLE pet: every adapter's usage in [start, end).
    const evs = all.filter((e) => e.ts >= event.windowStart && e.ts < event.windowEnd);
    const meanByAdapter = baselineMeans(this.state_.baselines);
    const signals = computeWindowSignals(evs, event.windowStart, event.windowEnd, meanByAdapter);

    // A hatch checkpoint hatches the egg and rolls like any molt, but it is a
    // bonus peek at the first 10 min — it must NOT feed diet or the normalization
    // baseline (those come only from the real 5-h windows), or it would double-
    // count the overlap and skew normalization.
    const isHatch = event.hatch === true;
    const committedThisMolt = pet.stage === 'egg';
    if (committedThisMolt) {
      this.commitHouse(pet, evs, effects);
      // Entering the sprite stage fresh: the maturity clock starts at 0 (the
      // hatch molt itself does not count toward sprite→rookie).
      pet.stageMolts = 0;
    }

    pet.moltCount += 1;
    if (!isHatch) this.accumulateDiet(pet, evs, meanByAdapter);

    if (!committedThisMolt) {
      this.progressStage(pet, signals, rng, effects, event.at);
    }

    this.rollTrait(pet, signals, rng, effects);
    this.checkPatterns(pet, effects);
    this.applyRhythmVariant(pet, signals);
    this.rollMutation(pet, rng, effects);
    rollGrade(pet, signals, rng, effects);

    effects.push({ type: 'molt', at: event.at });
    // Normalize per adapter against its OWN baseline (design §6): fold each
    // adapter's window essence into that adapter's running mean.
    if (!isHatch) foldWindowBaselines(this.state_, evs);
    evaluateAchievements(this.state_, this.pack, event.at, effects);
    this.capture('molt', event.at, effects);
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
    const home = bestGene && bestEss >= wildEssence ? houseByGene.get(bestGene)! : 'wild';
    // Cosmetic spread (inv 3/5): per-install salt picks a non-home House.
    pet.house = biasedHouse(this.pack, home, this.config.salt);

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

  private accumulateDiet(
    pet: PetState,
    evs: readonly UsageEvent[],
    meanByAdapter: Record<string, number>,
  ): void {
    // Each event's essence is normalized against ITS adapter's own baseline mean
    // (design §6), so diet diversity never inflates with raw volume or adapter
    // count. Cold-start adapters (no baseline yet) use a neutral denominator of 1.
    for (const ev of evs) {
      const mean = meanByAdapter[ev.adapter] ?? 0;
      const denom = mean > 0 ? mean : 1;
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
    at: number,
  ): void {
    const species = this.speciesById(pet.speciesId);
    if (!species || species.evolvesTo.length === 0) return; // terminal: no maturity clock

    // This molt matures the current stage. Evolution is gated on BOTH the stage's
    // maturity requirement (pacing) and any quality gate (prime→apex needs B), so
    // the egg→apex climb spans ~5 active days instead of one stage per molt. The
    // branch draw (which consumes RNG) only happens once eligible — the decision
    // is a pure function of persisted state, so determinism is preserved.
    pet.stageMolts += 1;
    if (pet.stageMolts < requiredMaturity(pet.stage)) return; // still maturing
    if (!evolutionGateMet(pet)) return; // matured but quality-gated (held at the crest)

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
    pet.stageMolts = 0; // reset the maturity clock for the new stage
    this.ownSpecies(target.id);
    effects.push({ type: 'evolved', from, to: target.id, stage: target.stage });
    this.capture('evolution', at, effects);
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
      contentVersion: this.pack.season,
      recordedAt: event.at,
    };
    if (archiveRecord(this.state_.archive, record)) {
      effects.push({ type: 'archive_record', record });
    }
    // New source of truth: the top-3 Dex record store (the Archive above is kept
    // as a back-compat mirror). Capture BEFORE the pet is replaced below.
    this.capture('rebirth', event.at, effects);

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

    evaluateAchievements(this.state_, this.pack, event.at, effects);
  }

  // --- helpers --------------------------------------------------------------

  private speciesById(id: string): SpeciesDef | undefined {
    return this.pack.species.find((sp) => sp.id === id);
  }

  private ownSpecies(id: string): void {
    if (!this.state_.dexOwned.includes(id)) this.state_.dexOwned.push(id);
  }

  /**
   * Capture the current pet as a candidate Dex record (top-3 per species). Fires
   * at molt close, evolution, and rebirth so a species keeps its best lives even
   * when they never reach the weekly Archive. Skips the pre-hatch egg (nothing to
   * record). Deterministic: the snapshot is a pure copy + total-order insert.
   */
  private capture(reason: DexSnapshot['reason'], at: number, effects: GameEffect[]): void {
    if (this.state_.pet.stage === 'egg') return;
    const snap = petSnapshot(this.state_.pet, this.pack.season, at, reason);
    if (tryCaptureSnapshot(this.state_.dexRecords, snap)) {
      effects.push({ type: 'dex_record', snapshot: snap });
    }
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
