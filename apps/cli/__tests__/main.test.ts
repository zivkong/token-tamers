import { describe, it, expect } from 'vitest';
import { parseArgs, dispatch, shouldBackgroundCheck, VERSION } from '../src/main';
import { setDataDirForTesting } from '../src/stores';

describe('parseArgs', () => {
  it('defaults to the shell command when no positional is given', () => {
    expect(parseArgs([]).command).toBe('shell');
  });

  it('picks the first positional as the command', () => {
    expect(parseArgs(['status']).command).toBe('status');
    expect(parseArgs(['dex', 'extra']).command).toBe('dex');
  });

  it('parses global flags', () => {
    const p = parseArgs(['init', '--yes', '--no-color']);
    expect(p.command).toBe('init');
    expect(p.yes).toBe(true);
    expect(p.noColor).toBe(true);
  });

  it('recognizes --version and --help', () => {
    expect(parseArgs(['--version']).version).toBe(true);
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-v']).version).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('flags before a positional do not become the command', () => {
    const p = parseArgs(['--no-color', 'watch']);
    expect(p.command).toBe('watch');
    expect(p.noColor).toBe(true);
  });
});

describe('shouldBackgroundCheck', () => {
  it('fires the throttled check for the common launch commands', () => {
    for (const c of ['status', 'dex', 'archive', 'complete', 'adapters', 'init']) {
      expect(shouldBackgroundCheck(parseArgs([c]))).toBe(true);
    }
  });

  it('does not fire for hot paths, self-checking, long-running, or shell/battle', () => {
    // statusline (Claude Code spawns it every refresh), update (does its own check),
    // watch (long-running), shell + battle (launchShell fires it themselves).
    for (const c of ['statusline', 'update', 'watch', 'shell', 'battle']) {
      expect(shouldBackgroundCheck(parseArgs([c]))).toBe(false);
    }
    expect(shouldBackgroundCheck(parseArgs([]))).toBe(false); // bare `tt` → shell
  });

  it('does not fire for --version / --help', () => {
    expect(shouldBackgroundCheck(parseArgs(['--version']))).toBe(false);
    expect(shouldBackgroundCheck(parseArgs(['--help']))).toBe(false);
  });
});

describe('dispatch', () => {
  it('prints the version and returns 0', async () => {
    let out = '';
    const code = await dispatch(parseArgs(['--version']), (s) => {
      out += s;
    });
    expect(code).toBe(0);
    expect(out.trim()).toBe(VERSION);
  });

  it('prints help and returns 0', async () => {
    let out = '';
    const code = await dispatch(parseArgs(['--help']), (s) => {
      out += s;
    });
    expect(code).toBe(0);
    expect(out).toContain('Usage: tt');
  });

  it('rejects unknown commands', async () => {
    let out = '';
    const code = await dispatch(parseArgs(['frobnicate']), (s) => {
      out += s;
    });
    expect(code).toBe(1);
    expect(out).toContain('Unknown command');
  });

  it('status before init prints a friendly message and returns 1', async () => {
    // Point at an empty home so no config exists.
    setDataDirForTesting(`/tmp/tt-nonexistent-${process.pid}-${Date.now()}`);
    try {
      let out = '';
      const code = await dispatch(parseArgs(['status']), (s) => {
        out += s;
      });
      expect(code).toBe(1);
      expect(out.toLowerCase()).toContain('tt init');
    } finally {
      setDataDirForTesting(null);
    }
  });
});
