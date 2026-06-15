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

/**
 * Deterministic FNV-1a/32 over an ASCII string, rendered as a fixed 5-char
 * base32 signature. Integrity/typo check, NOT cryptographic security.
 */
export function checksum(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const u = h >>> 0;
  return bytesToBase32([(u >>> 16) & 0xff, (u >>> 8) & 0xff, u & 0xff]);
}
