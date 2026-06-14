/** SHA-256 integrity helpers. Uses node:crypto (NOT a network module). */

import { createHash } from 'node:crypto';

/** Lowercase hex SHA-256 of a buffer. */
export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Parse a `SHA256SUMS` file (`<64-hex>  <name>` per line, an optional `*`
 * binary marker tolerated) into a `name → hex` map.
 */
export function parseSha256Sums(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/.exec(line);
    if (m) out[m[2]!] = m[1]!.toLowerCase();
  }
  return out;
}
