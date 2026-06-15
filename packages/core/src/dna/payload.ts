/**
 * Byte-level primitives for the DNA codec: unsigned LEB128 varints and a
 * Crockford base32 alphabet. Pure and deterministic — no node:* (invariant 4),
 * no Buffer, no Date/random. Operates on plain number[] byte arrays so it works
 * identically in core (which may not import node builtins).
 *
 * Crockford base32 is chat/URL-safe (no +,/,=, no padding) and case-insensitive
 * on decode (I/L→1, O→0), so codes survive copy-paste across chat clients.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const DECODE_MAP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET[i]!] = i;
  // Crockford visual aliases.
  map['O'] = 0;
  map['I'] = 1;
  map['L'] = 1;
  return map;
})();

export interface ByteReader {
  bytes: number[];
  pos: number;
}

export function createReader(bytes: number[]): ByteReader {
  return { bytes, pos: 0 };
}

/** Append an unsigned LEB128 varint. Handles values beyond 32 bits via /128. */
export function writeVarint(out: number[], value: number): void {
  let v = Math.max(0, Math.floor(value));
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v & 0x7f);
}

/** Read an unsigned LEB128 varint; returns 0 (and stops) if the stream runs dry. */
export function readVarint(r: ByteReader): number {
  let result = 0;
  let shift = 1;
  for (;;) {
    if (r.pos >= r.bytes.length) break;
    const byte = r.bytes[r.pos++]!;
    result += (byte & 0x7f) * shift;
    shift *= 128;
    if ((byte & 0x80) === 0) break;
  }
  return result;
}

/** Encode a byte array as unpadded Crockford base32 (uppercase). */
export function bytesToBase32(bytes: number[]): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 31];
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Decode Crockford base32 back to bytes; ignores any stray non-alphabet chars. */
export function base32ToBytes(s: string): number[] {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s.toUpperCase()) {
    const idx = DECODE_MAP[ch];
    if (idx === undefined) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
      value &= (1 << bits) - 1;
    }
  }
  return out;
}

/** Deterministic FNV-1a/32 over a byte array (integrity tag, NOT cryptographic). */
export function fnv32(bytes: number[]): number {
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic byte keystream (mulberry32) used to WHITEN the payload so the
 * code reads as a high-entropy opaque token (no tell-tale zero runs / patterns)
 * rather than a short editable string. Reversible — XOR with the same seed
 * restores the bytes. This is obfuscation, not encryption: a shared code carries
 * no secret (any client must decode it), so the keystream seed travels with the
 * code (the integrity tag). Pure.
 */
export function keystream(seed: number, n: number): number[] {
  let a = seed >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    out.push(((t ^ (t >>> 14)) >>> 0) & 0xff);
  }
  return out;
}

/** Insert a separator every `size` chars (license-key style grouping). */
export function groupChars(s: string, size = 4): string {
  const parts: string[] = [];
  for (let i = 0; i < s.length; i += size) parts.push(s.slice(i, i + size));
  return parts.join('-');
}
