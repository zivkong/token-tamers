/**
 * The DNA hash codec (design §10) — pure, deterministic, no I/O.
 *
 * Format:  TTX<v>-XXXX-XXXX-…   e.g. TTX1-K7Q2-RM9B-Q8VZ-3NJ4-PW0S-LX2A
 *
 * A "proper" opaque, license-key-style token: the field payload is a flat
 * unsigned-varint stream (fixed, APPEND-ONLY order, plus a reserved extension
 * area for future data), tagged with an FNV-1a integrity word, then WHITENED with
 * a keystream seeded by that tag so the output is high-entropy (no tell-tale zero
 * runs) — it reads like an encoded blob, not a short editable pattern. It is
 * still fully DETERMINISTIC (same snapshot ⇒ same code): the Dex renders it live,
 * battles/replays decode it, and a golden test locks the byte layout. It is NOT
 * encryption — a shared code carries no secret; the whitening seed (the tag)
 * travels with the code so any client can decode it.
 *
 * Layout (bytes, before base32 + grouping):
 *   [ tag:4 big-endian ] [ whiten(payload) ]
 *   payload = formatVer · contentMin · speciesNum · grade · stage · house ·
 *             pwr · spd · wis · grt · generation · pattern · rhythm ·
 *             traits[] · mutations[] · extLen · ext…   (all unsigned varints)
 *
 * Forward-compatibility (invariant 7 — codes parse forever):
 *  - The keystream prefix is stable, so appended/unknown trailing bytes leave the
 *    known leading fields decodable; a higher formatVer or unknown ext records are
 *    read-and-skipped, never rejected.
 *  - Enum/trait/mutation indices beyond the local registry decode as dormant
 *    "unknown" genes (collected in `unknown`), never a throw.
 *  - The integrity tag flags tampering (`sigValid`) without ever throwing.
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
  createReader,
  fnv32,
  groupChars,
  keystream,
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

/** Visible format version (the `TTX<v>` prefix). Append-only field layout. */
export const DNA_SCHEMA_VERSION = 1;

export interface DecodedDna {
  /** Payload format version (read from the decoded bytes). */
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
  /** True when the recomputed integrity tag matched (no tampering/truncation). */
  sigValid: boolean;
  /** Indices the local registry could not resolve (newer content) → dormant. */
  unknown: { traits: number[]; mutations: number[] };
}

const CODE_RE = /^TTX(\d+)-([0-9A-Za-z-]+)$/;

function writeList(out: number[], indices: number[]): void {
  writeVarint(out, indices.length);
  for (const i of indices) writeVarint(out, i);
}

/** Build the flat varint payload for a snapshot (pre-tag, pre-whitening). */
function buildPayload(snap: DexSnapshot, speciesNum: number): number[] {
  const p: number[] = [];
  writeVarint(p, DNA_SCHEMA_VERSION);
  writeVarint(p, snap.contentVersion);
  writeVarint(p, speciesNum);
  writeVarint(p, Math.max(0, codeIndex(GRADE_CODES, snap.grade)));
  writeVarint(p, Math.max(0, codeIndex(STAGE_CODES, snap.stage)));
  writeVarint(p, Math.max(0, codeIndex(HOUSE_CODES, snap.house)));
  writeVarint(p, snap.stats.pwr);
  writeVarint(p, snap.stats.spd);
  writeVarint(p, snap.stats.wis);
  writeVarint(p, snap.stats.grt);
  writeVarint(p, snap.generation);
  writeVarint(p, snap.pattern ? codeIndex(PATTERN_CODES, snap.pattern) + 1 : 0);
  writeVarint(p, snap.rhythmVariant ? codeIndex(RHYTHM_CODES, snap.rhythmVariant) + 1 : 0);
  writeList(
    p,
    snap.traits.map((t) => codeIndex(TRAIT_CODES, t)).filter((i) => i >= 0),
  );
  writeList(
    p,
    snap.mutations.map((m) => codeIndex(MUTATION_CODES, m)).filter((i) => i >= 0),
  );
  writeVarint(p, 0); // reserved extension length (future TLV data appends here)
  return p;
}

/** Encode a snapshot to a DNA code. `speciesNum` is the pack's species number. */
export function encodeDna(snap: DexSnapshot, opts: { speciesNum: number }): string {
  const p = buildPayload(snap, opts.speciesNum);
  const tag = fnv32(p);
  const ks = keystream(tag, p.length);
  const body = [
    (tag >>> 24) & 0xff,
    (tag >>> 16) & 0xff,
    (tag >>> 8) & 0xff,
    tag & 0xff,
    ...p.map((b, i) => b ^ ks[i]!),
  ];
  return `TTX${DNA_SCHEMA_VERSION}-${groupChars(bytesToBase32(body))}`;
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
  const body = base32ToBytes(m[2]!.replace(/-/g, ''));
  if (body.length < 5) return emptyDecode();

  const tag = ((body[0]! << 24) | (body[1]! << 16) | (body[2]! << 8) | body[3]!) >>> 0;
  const whitened = body.slice(4);
  const ks = keystream(tag, whitened.length);
  const p = whitened.map((b, i) => b ^ ks[i]!);
  const sigValid = fnv32(p) === tag;

  const r = createReader(p);
  const schema = readVarint(r);
  const contentMin = readVarint(r);
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
  const extLen = readVarint(r);
  for (let i = 0; i < extLen; i++) readVarint(r); // skip reserved/unknown TLV records

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
