/**
 * `tt statusline` — capture the real subscription reset times from Claude Code.
 *
 * Claude Code ≥2.1.x pipes a JSON payload to the configured statusLine command on
 * stdin, the ONLY surface carrying `rate_limits.five_hour.resets_at` /
 * `seven_day.resets_at` (verified against the official statusline docs — hooks and
 * other surfaces do not carry it, and it is persisted to no file). This command
 * reads that stdin, records the reset instants to ~/.tokentamers/usage.json, and
 * prints a compact line so it doubles as a usable status line.
 *
 * Wiring (opt-in, never auto-installed): set it as your statusLine command, or
 * chain it ahead of an existing one. Bootstrap once without a live session by
 * piping a captured payload: `cat <payload>.json | tt statusline`.
 *
 * Read-only: it observes usage Claude Code already computed — it never calls any
 * API or spends tokens (invariant 1/2). The cli owns the wall clock; core stays
 * deterministic.
 */

import { loadState, loadUsage, mergeUsage, saveUsage } from '../stores';

export interface RateReading {
  /** Next 5-hour reset, epoch MS (resets_at × 1000). */
  fiveHourResetsAt?: number;
  /** Next 7-day reset, epoch MS. */
  sevenDayResetsAt?: number;
  fiveHourPct?: number;
  sevenDayPct?: number;
}

/**
 * Pure: pull the reset instants (unix seconds → ms) and used-percentages from a
 * Claude Code statusLine stdin payload. Tolerant of missing/garbage input — any
 * shape that is not the expected one yields an empty reading rather than throwing.
 */
export function parseRateLimits(raw: string): RateReading {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return {};
  }
  const rl = field(payload, 'rate_limits');
  if (rl === undefined) return {};
  const five = field(rl, 'five_hour');
  const seven = field(rl, 'seven_day');
  return {
    fiveHourResetsAt: resetMs(five),
    sevenDayResetsAt: resetMs(seven),
    fiveHourPct: pct(five),
    sevenDayPct: pct(seven),
  };
}

export async function statuslineCommand(
  out: (s: string) => void,
  readInput: () => Promise<string> = readStdin,
  nowMs: number = Date.now(),
): Promise<void> {
  let raw = '';
  try {
    raw = await readInput();
  } catch {
    // A statusLine command must never break the host UI — degrade silently.
  }
  const reading = parseRateLimits(raw);
  if (reading.fiveHourResetsAt !== undefined || reading.sevenDayResetsAt !== undefined) {
    try {
      saveUsage(mergeUsage(loadUsage(), reading, nowMs));
    } catch {
      // Best-effort capture; never fail the status line on a write hiccup.
    }
  }
  out(renderLine(reading));
}

function renderLine(r: RateReading): string {
  const parts: string[] = [];
  const pet = safePetLabel();
  if (pet) parts.push(pet);
  if (r.fiveHourPct !== undefined) parts.push(`5h ${r.fiveHourPct}%`);
  if (r.sevenDayPct !== undefined) parts.push(`7d ${r.sevenDayPct}%`);
  return `${parts.length > 0 ? parts.join(' · ') : 'Token Tamers'}\n`;
}

/** Best-effort pet stage for the line; never throws (state may be absent). */
function safePetLabel(): string | null {
  try {
    const s = loadState();
    return s ? `🐾 ${s.pet.stage}` : null;
  } catch {
    return null;
  }
}

function field(obj: unknown, key: string): unknown {
  if (obj === null || typeof obj !== 'object') return undefined;
  return (obj as Record<string, unknown>)[key];
}

function resetMs(window: unknown): number | undefined {
  const sec = field(window, 'resets_at');
  return typeof sec === 'number' && Number.isFinite(sec) && sec > 0
    ? Math.round(sec * 1000)
    : undefined;
}

function pct(window: unknown): number | undefined {
  const p = field(window, 'used_percentage');
  return typeof p === 'number' && Number.isFinite(p) ? Math.round(p) : undefined;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}
