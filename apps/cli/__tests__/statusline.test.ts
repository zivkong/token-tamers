import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseRateLimits, statuslineCommand } from '../src/commands/statusline';
import { loadUsage, mergeUsage, setDataDirForTesting } from '../src/stores';

// A real Claude Code ≥2.1.x statusLine payload (anonymized, reset times intact).
const PAYLOAD = JSON.stringify({
  version: '2.1.179',
  rate_limits: {
    five_hour: { used_percentage: 31, resets_at: 1781714400 },
    seven_day: { used_percentage: 83, resets_at: 1781712000 },
  },
});

describe('parseRateLimits', () => {
  it('extracts reset instants (sec→ms) and percentages', () => {
    const r = parseRateLimits(PAYLOAD);
    expect(r.fiveHourResetsAt).toBe(1781714400 * 1000);
    expect(r.sevenDayResetsAt).toBe(1781712000 * 1000);
    expect(r.fiveHourPct).toBe(31);
    expect(r.sevenDayPct).toBe(83);
  });

  it('tolerates garbage and missing fields', () => {
    expect(parseRateLimits('not json')).toEqual({});
    expect(parseRateLimits('{}')).toEqual({});
    const only7d = parseRateLimits(
      JSON.stringify({ rate_limits: { seven_day: { resets_at: 1781712000 } } }),
    );
    expect(only7d.sevenDayResetsAt).toBe(1781712000 * 1000);
    expect(only7d.fiveHourResetsAt).toBeUndefined();
  });

  it('rejects non-positive / non-numeric resets_at', () => {
    const zero = parseRateLimits(JSON.stringify({ rate_limits: { five_hour: { resets_at: 0 } } }));
    expect(zero.fiveHourResetsAt).toBeUndefined();
    const str = parseRateLimits(JSON.stringify({ rate_limits: { five_hour: { resets_at: 'x' } } }));
    expect(str.fiveHourResetsAt).toBeUndefined();
  });
});

describe('mergeUsage — forward-only per window', () => {
  it('keeps the later reset and never erases a known one', () => {
    const a = mergeUsage(null, { sevenDayResetsAt: 100, fiveHourResetsAt: 10 }, 1);
    expect(a).toMatchObject({ sevenDayResetsAt: 100, fiveHourResetsAt: 10, capturedAt: 1 });
    // A later capture carrying only the 5h window must not erase the 7d reset.
    const b = mergeUsage(a, { fiveHourResetsAt: 20 }, 2);
    expect(b).toMatchObject({ sevenDayResetsAt: 100, fiveHourResetsAt: 20, capturedAt: 2 });
    // A stale (earlier) 5h reading never moves the window backward.
    const c = mergeUsage(b, { fiveHourResetsAt: 15 }, 3);
    expect(c.fiveHourResetsAt).toBe(20);
  });
});

describe('statuslineCommand', () => {
  let home: string;
  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-sl-'));
    setDataDirForTesting(home);
  });
  afterEach(() => {
    setDataDirForTesting(null);
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('captures resets to usage.json and prints a line', async () => {
    let printed = '';
    await statuslineCommand(
      (s) => (printed += s),
      async () => PAYLOAD,
      12345,
    );
    const u = loadUsage();
    expect(u?.sevenDayResetsAt).toBe(1781712000 * 1000);
    expect(u?.fiveHourResetsAt).toBe(1781714400 * 1000);
    expect(u?.capturedAt).toBe(12345);
    expect(printed).toContain('7d 83%');
  });

  it('writes nothing when the payload has no rate_limits, but still prints', async () => {
    let printed = '';
    await statuslineCommand(
      (s) => (printed += s),
      async () => '{}',
      1,
    );
    expect(loadUsage()).toBeNull();
    expect(printed.trim().length).toBeGreaterThan(0);
  });
});
