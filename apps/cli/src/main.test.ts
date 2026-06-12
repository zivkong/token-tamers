import { describe, it, expect } from 'vitest';
import { parseArgs, dispatch, VERSION } from './main';

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
    const prev = process.env['TOKENTAMERS_HOME'];
    process.env['TOKENTAMERS_HOME'] = `/tmp/tt-nonexistent-${process.pid}-${Date.now()}`;
    try {
      let out = '';
      const code = await dispatch(parseArgs(['status']), (s) => {
        out += s;
      });
      expect(code).toBe(1);
      expect(out.toLowerCase()).toContain('tt init');
    } finally {
      if (prev === undefined) delete process.env['TOKENTAMERS_HOME'];
      else process.env['TOKENTAMERS_HOME'] = prev;
    }
  });
});
