/**
 * Unicode 16.0 BLOCK OCTANT glyph table for the 2x4 sub-cell compositor.
 *
 * Each terminal cell is a 2-wide x 4-tall sub-pixel grid; a render mask has bit
 * `p-1` set for octant position `p`, numbered row-major:
 *
 *     1 2      (bit 0, bit 1)
 *     3 4      (bit 2, bit 3)
 *     5 6      (bit 4, bit 5)
 *     7 8      (bit 6, bit 7)
 *
 * Unicode 16 encodes 230 of the 256 patterns as "BLOCK OCTANT-<positions>" in a
 * CONTIGUOUS range U+1CD00..U+1CDE5 (so codepoint = 0x1CD00 + index into the
 * ordered position list below). The other 26 patterns were already encoded as
 * Block Elements and are mapped in REUSED:
 *   - 16 are quadrant-family (space / quadrants U+2596..U+259F / halves / full),
 *   - 2 are exact quarter-rows (lower 1/4 U+2582, lower 3/4 U+2586),
 *   - 8 are rare single-sub-pixel / mid-pair / top-quarter patterns with no exact
 *     Block-Element glyph; they fall back to their nearest containing quadrant/half
 *     (visually <= half a quadrant off, and uncommon after 2-color quantization).
 *
 * Source data: the BLOCK OCTANT names from the Unicode Character Database
 * (verified anchors U+1CDB4=OCTANT-1478, U+1CDC1=OCTANT-23578). Embedded so the
 * build stays offline and deterministic.
 */

// The 230 octant position-strings in code point order (codepoint = 0x1CD00 + i).
// prettier-ignore
const OCTANT_POSITIONS =
  '3 23 123 4 14 124 34 134 234 5 15 25 125 135 235 1235 45 145 245 1245 345 1345 2345 12345 6 16 26 126 36 136 236 1236 146 246 1246 346 1346 2346 12346 56 156 256 1256 356 1356 2356 12356 456 1456 2456 12456 3456 13456 23456 17 27 127 37 137 237 1237 47 147 247 1247 347 1347 2347 12347 157 257 1257 357 2357 12357 457 1457 12457 3457 13457 23457 67 167 267 1267 367 1367 2367 12367 467 1467 2467 12467 3467 13467 23467 123467 567 1567 2567 12567 3567 13567 23567 123567 4567 14567 24567 124567 34567 134567 234567 1234567 18 28 128 38 138 238 1238 48 148 248 1248 348 1348 2348 12348 58 158 258 1258 358 1358 2358 12358 458 1458 2458 12458 3458 13458 23458 123458 168 268 1268 368 2368 12368 468 1468 12468 3468 13468 23468 568 1568 2568 12568 3568 13568 23568 123568 4568 14568 24568 124568 34568 134568 234568 1234568 178 278 1278 378 1378 2378 12378 478 1478 2478 12478 3478 13478 23478 123478 578 1578 2578 12578 3578 13578 23578 123578 4578 14578 24578 124578 34578 134578 234578 1234578 678 1678 2678 12678 3678 13678 23678 123678 4678 14678 24678 124678 34678 134678 234678 1234678 15678 25678 125678 35678 235678 1235678 45678 145678 1245678 1345678 2345678'.split(
    ' ',
  );

// The 26 patterns NOT in the octant block, mapped to their Block-Element glyph
// (or nearest approximation for the 8 that have no exact char).
const REUSED: Record<number, number> = {
  0: 0x20, // empty -> space
  255: 0x2588, // full -> FULL BLOCK
  15: 0x2580, // top half -> UPPER HALF
  240: 0x2584, // bottom half -> LOWER HALF
  85: 0x258c, // left col -> LEFT HALF
  170: 0x2590, // right col -> RIGHT HALF
  5: 0x2598, // UL quadrant
  10: 0x259d, // UR quadrant
  80: 0x2596, // LL quadrant
  160: 0x2597, // LR quadrant
  90: 0x259e, // UR+LL
  165: 0x259a, // UL+LR
  95: 0x259b, // UL+UR+LL
  175: 0x259c, // UL+UR+LR
  245: 0x2599, // UL+LL+LR
  250: 0x259f, // UR+LL+LR
  192: 0x2582, // bottom row -> LOWER ONE QUARTER
  252: 0x2586, // bottom 3 rows -> LOWER THREE QUARTERS
  // --- no exact glyph: nearest containing quadrant/half ---
  1: 0x2598, // top-left sub-pixel  ~ UL quadrant
  2: 0x259d, // top-right sub-pixel ~ UR quadrant
  3: 0x2580, // top row            ~ upper half
  20: 0x258c, // mid-left pair      ~ left half
  40: 0x2590, // mid-right pair     ~ right half
  63: 0x2580, // top 3 rows         ~ upper half
  64: 0x2596, // bottom-left sub-pixel  ~ LL quadrant
  128: 0x2597, // bottom-right sub-pixel ~ LR quadrant
};

function buildOctantTable(): string[] {
  const table = new Array<string>(256).fill(' ');
  for (let i = 0; i < OCTANT_POSITIONS.length; i++) {
    let mask = 0;
    for (const d of OCTANT_POSITIONS[i]!) mask |= 1 << (Number(d) - 1);
    table[mask] = String.fromCodePoint(0x1cd00 + i);
  }
  for (const [mask, cp] of Object.entries(REUSED)) {
    table[Number(mask)] = String.fromCodePoint(cp);
  }
  return table;
}

/** 256-entry table: 2x4 fg-mask -> the block glyph that fills exactly those sub-pixels. */
export const OCTANT_TABLE: ReadonlyArray<string> = buildOctantTable();
