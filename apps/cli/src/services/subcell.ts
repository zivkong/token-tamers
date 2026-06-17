/**
 * Sub-cell density resolution: turn the `SubcellPreference` (settings.json) into a
 * concrete renderer mode, probing the terminal when set to `auto`.
 *
 * The probe is a cursor-WIDTH test (no `process.env` — invariant: zero env config):
 * write a test glyph at a known column, ask the terminal for the cursor position
 * (DSR, `CSI 6 n` -> `CSI row ; col R`), and see how many columns the glyph advanced.
 * A terminal that lacks the glyph typically renders it double-width (a wide
 * replacement) or never answers — both downgrade us off that rung. It is
 * best-effort (a width-1 tofu box can slip through), so the `subcell` setting is the
 * always-available manual override.
 */

import type { SubcellPreference } from '@token-tamers/core';
import type { SubcellName } from '@token-tamers/tui';

const ESC = String.fromCharCode(27);
const DSR = `${ESC}[6n`; // request cursor position
const ERASE_LINE = `\r${ESC}[2K`; // CR + erase line
const OCTANT_PROBE = '\u{1CD00}'; // BLOCK OCTANT-3 (Unicode 16)
const SEXTANT_PROBE = '\u{1FB00}'; // BLOCK SEXTANT-1 (Unicode 13)

/** A probe: render `glyph` and return its column width, or null if unprobeable. */
export type GlyphWidthProbe = (glyph: string) => Promise<number | null>;

/**
 * Resolve the preference to a concrete renderer mode. Non-`auto` is returned as-is;
 * `auto` probes richest-first (octant -> sextant -> half). When the terminal can't be
 * probed (non-TTY / no DSR), fall back to sextant — a safe, broadly-supported middle.
 */
export async function resolveSubcellMode(
  pref: SubcellPreference,
  probe: GlyphWidthProbe = probeGlyphWidth,
): Promise<SubcellName> {
  if (pref === 'octant' || pref === 'sextant' || pref === 'half') return pref;
  const octant = await probe(OCTANT_PROBE);
  if (octant === 1) return 'octant';
  if (octant === null) return 'sextant';
  const sextant = await probe(SEXTANT_PROBE);
  if (sextant === 1) return 'sextant';
  return 'half';
}

/**
 * Measure a glyph's terminal column width via a cursor-position report. Returns
 * null when stdin/stdout aren't an interactive TTY or the terminal never answers
 * (so the caller can fall back). Restores raw-mode state and erases the test glyph.
 */
export async function probeGlyphWidth(glyph: string, timeoutMs = 200): Promise<number | null> {
  const { stdin, stdout } = process;
  if (!stdout.isTTY || !stdin.isTTY || typeof stdin.setRawMode !== 'function') return null;
  let wasRaw = false;
  // NEVER throw: this runs at every launch, so any terminal/IO hiccup must degrade
  // to a safe `null` (the caller falls back) rather than break starting the shell.
  try {
    wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdout.write('\r'); // cursor to column 1
    stdout.write(glyph);
    const col = await requestCursorCol(timeoutMs);
    stdout.write(ERASE_LINE); // wipe the test glyph off the real screen
    return col === null ? null : col - 1; // width = (1-based col after glyph) - 1
  } catch {
    return null;
  } finally {
    try {
      if (!wasRaw) stdin.setRawMode(false);
    } catch {
      // best-effort restore
    }
  }
}

/** Send DSR and resolve the reported 1-based cursor column, or null on timeout. */
function requestCursorCol(timeoutMs: number): Promise<number | null> {
  const { stdin, stdout } = process;
  return new Promise((resolve) => {
    let buf = '';
    let done = false;
    const finish = (v: number | null): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stdin.removeListener('data', onData);
      resolve(v);
    };
    const onData = (chunk: Buffer | string): void => {
      buf += chunk.toString('latin1');
      const m = /\[(\d+);(\d+)R/.exec(buf);
      if (m) finish(Number(m[2]));
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    stdin.on('data', onData);
    stdout.write(DSR);
  });
}
