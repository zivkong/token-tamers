/**
 * The DNA hash codec (design §10) — pure, deterministic, no I/O.
 *
 * Format:  TT<schema>-c<content_min>-<payload>-<sig>   e.g. TT2-c1-aTh7mK4q-9f0kp
 *
 * The payload is a flat unsigned-varint stream in a FIXED, APPEND-ONLY field
 * order (new schema versions may only append fields at the end), rendered as
 * Crockford base32. Enum values encode as their index in the frozen registry
 * tables (registry.ts); species encodes as its content-pack `num` (additive-
 * stable), supplied by the caller because core holds no content pack.
 *
 * Forward-compatibility (invariant 7 — hashes parse forever):
 *  - A higher `<schema>` than this client knows: the known leading fields decode
 *    by position; trailing unknown bytes are ignored.
 *  - An enum/trait/mutation index beyond the local table decodes as a dormant
 *    "unknown" gene (collected in `unknown`), never a throw.
 *  - The `<sig>` is recomputed over the literal header+payload string, so it
 *    validates even codes a client can't fully interpret.
 */

import type {
  DexSnapshot,
  Grade,
  House,
  PatternId,
  RhythmVariant,
  Stage,
  Stats,
  TraitId,
} from '../types';
import {
  base32ToBytes,
  bytesToBase32,
  checksum,
  createReader,
  readVarint,
  writeVarint,
  type ByteReader,
} from './payload';
import {
  codeIndex,
  GRADE_CODES,
  HOUSE_CODES,
  MUTATION_CODES,
  PATTERN_CODES,
  RHYTHM_CODES,
  STAGE_CODES,
  TRAIT_CODES,
} from './registry';

/** Payload schema version. Bumps only when the field layout changes (append-only). */
export const DNA_SCHEMA_VERSION = 2;

export interface DecodedDna {
  schema: number;
  /** Minimum content pack revision required to fully resolve species/content. */
  contentMin: number;
  /** Content-pack species `num`; map back to a species via the local pack. */
  speciesNum: number;
  grade: Grade;
  stats: Stats;
  house: House;
  stage: Stage;
  traits: TraitId[];
  pattern: PatternId | null;
  rhythmVariant: RhythmVariant | null;
  mutations: string[];
  generation: number;
  /** True when the recomputed checksum matched the code's `<sig>`. */
  sigValid: boolean;
  /** Indices the local registry could not resolve (newer content) → dormant. */
  unknown: { traits: number[]; mutations: number[] };
}

const CODE_RE = /^TT(\d+)-c(\d+)-([0-9A-Za-z]+)-([0-9A-Za-z]+)$/;

function writeList(out: number[], indices: number[]): void {
  writeVarint(out, indices.length);
  for (const i of indices) writeVarint(out, i);
}

/** Encode a snapshot to a DNA code. `speciesNum` is the pack's species number. */
export function encodeDna(snap: DexSnapshot, opts: { speciesNum: number }): string {
  const bytes: number[] = [];
  writeVarint(bytes, opts.speciesNum);
  writeVarint(bytes, Math.max(0, codeIndex(GRADE_CODES, snap.grade)));
  writeVarint(bytes, Math.max(0, codeIndex(STAGE_CODES, snap.stage)));
  writeVarint(bytes, Math.max(0, codeIndex(HOUSE_CODES, snap.house)));
  writeVarint(bytes, snap.stats.pwr);
  writeVarint(bytes, snap.stats.spd);
  writeVarint(bytes, snap.stats.wis);
  writeVarint(bytes, snap.stats.grt);
  writeVarint(bytes, snap.generation);
  writeVarint(bytes, snap.pattern ? codeIndex(PATTERN_CODES, snap.pattern) + 1 : 0);
  writeVarint(bytes, snap.rhythmVariant ? codeIndex(RHYTHM_CODES, snap.rhythmVariant) + 1 : 0);
  writeList(
    bytes,
    snap.traits.map((t) => codeIndex(TRAIT_CODES, t)).filter((i) => i >= 0),
  );
  writeList(
    bytes,
    snap.mutations.map((m) => codeIndex(MUTATION_CODES, m)).filter((i) => i >= 0),
  );

  const payload = bytesToBase32(bytes);
  const header = `TT${DNA_SCHEMA_VERSION}-c${snap.contentVersion}`;
  const sig = checksum(`${header}-${payload}`);
  return `${header}-${payload}-${sig}`;
}

function readEnum<T>(r: ByteReader, table: readonly T[], fallback: T): T {
  const idx = readVarint(r);
  return idx < table.length ? table[idx]! : fallback;
}

function readNullableEnum<T>(r: ByteReader, table: readonly T[]): T | null {
  const raw = readVarint(r);
  if (raw === 0) return null;
  const idx = raw - 1;
  return idx < table.length ? table[idx]! : null;
}

function readTraitList(r: ByteReader): { traits: TraitId[]; unknown: number[] } {
  const n = readVarint(r);
  const traits: TraitId[] = [];
  const unknown: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = readVarint(r);
    if (idx < TRAIT_CODES.length) traits.push(TRAIT_CODES[idx]!);
    else unknown.push(idx);
  }
  return { traits, unknown };
}

function readMutationList(r: ByteReader): { mutations: string[]; unknown: number[] } {
  const n = readVarint(r);
  const mutations: string[] = [];
  const unknown: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = readVarint(r);
    if (idx < MUTATION_CODES.length) mutations.push(MUTATION_CODES[idx]!);
    else unknown.push(idx);
  }
  return { mutations, unknown };
}

function emptyDecode(): DecodedDna {
  return {
    schema: 0,
    contentMin: 0,
    speciesNum: 0,
    grade: 'C',
    stats: { pwr: 0, spd: 0, wis: 0, grt: 0 },
    house: 'wild',
    stage: 'egg',
    traits: [],
    pattern: null,
    rhythmVariant: null,
    mutations: [],
    generation: 0,
    sigValid: false,
    unknown: { traits: [], mutations: [] },
  };
}

/** Decode a DNA code. Never throws; malformed input returns defaults with sigValid=false. */
export function decodeDna(code: string): DecodedDna {
  const m = CODE_RE.exec(code.trim());
  if (!m) return emptyDecode();
  const schema = Number(m[1]);
  const contentMin = Number(m[2]);
  const payload = m[3]!;
  const sig = m[4]!;
  const sigValid = checksum(`TT${schema}-c${contentMin}-${payload}`) === sig.toUpperCase();

  const r = createReader(base32ToBytes(payload));
  const speciesNum = readVarint(r);
  const grade = readEnum(r, GRADE_CODES, 'C');
  const stage = readEnum(r, STAGE_CODES, 'egg');
  const house = readEnum(r, HOUSE_CODES, 'wild');
  const stats: Stats = {
    pwr: readVarint(r),
    spd: readVarint(r),
    wis: readVarint(r),
    grt: readVarint(r),
  };
  const generation = readVarint(r);
  const pattern = readNullableEnum(r, PATTERN_CODES);
  const rhythmVariant = readNullableEnum(r, RHYTHM_CODES);
  const traitRead = readTraitList(r);
  const mutationRead = readMutationList(r);

  return {
    schema,
    contentMin,
    speciesNum,
    grade,
    stats,
    house,
    stage,
    traits: traitRead.traits,
    pattern,
    rhythmVariant,
    mutations: mutationRead.mutations,
    generation,
    sigValid,
    unknown: { traits: traitRead.unknown, mutations: mutationRead.unknown },
  };
}
