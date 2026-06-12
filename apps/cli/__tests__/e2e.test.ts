import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInit } from '../src/commands/init';
import { statusCommand } from '../src/commands/status';
import { loadConfig } from '../src/stores/config';
import { loadState } from '../src/stores/state';

/**
 * End-to-end: set TOKENTAMERS_HOME + CLAUDE_CONFIG_DIR to temp dirs with a small
 * JSONL fixture, run init --yes, then assert state.json exists and the status
 * output mentions the pet.
 */

let home: string;
let claudeDir: string;
let savedHome: string | undefined;
let savedClaude: string | undefined;

function writeFixture(claudeRoot: string): void {
  const projectDir = path.join(claudeRoot, 'projects', 'encoded-path-test');
  fs.mkdirSync(projectDir, { recursive: true });

  // Spread events across several days so multiple 5h windows close.
  const base = Date.parse('2024-03-04T09:00:00.000Z'); // a Monday
  const lines: string[] = [];
  for (let day = 0; day < 6; day++) {
    for (let i = 0; i < 4; i++) {
      const ts = new Date(base + day * 86_400_000 + i * 3_600_000).toISOString();
      lines.push(
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            model: 'claude-sonnet-4-5-20250929',
            content: 'ok',
            usage: {
              input_tokens: 100 + i,
              output_tokens: 200 + i,
              cache_read_input_tokens: 10,
              cache_creation_input_tokens: 0,
            },
          },
          timestamp: ts,
          sessionId: 'sess-e2e',
          cwd: '/home/dev/proj',
        }),
      );
    }
  }
  fs.writeFileSync(path.join(projectDir, 'sess-e2e.jsonl'), lines.join('\n') + '\n', 'utf8');
}

beforeEach(() => {
  savedHome = process.env['TOKENTAMERS_HOME'];
  savedClaude = process.env['CLAUDE_CONFIG_DIR'];
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-home-'));
  claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-claude-'));
  process.env['TOKENTAMERS_HOME'] = home;
  process.env['CLAUDE_CONFIG_DIR'] = claudeDir;
  writeFixture(claudeDir);
});

afterEach(() => {
  if (savedHome === undefined) delete process.env['TOKENTAMERS_HOME'];
  else process.env['TOKENTAMERS_HOME'] = savedHome;
  if (savedClaude === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
  else process.env['CLAUDE_CONFIG_DIR'] = savedClaude;
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(claudeDir, { recursive: true, force: true });
});

describe('tt init --yes -> status (e2e)', () => {
  // A fixed clock well after the fixture window so molts have fired.
  const now = () => Date.parse('2024-03-20T00:00:00.000Z');

  it('writes config + state and surfaces the pet in status', async () => {
    let initOut = '';
    const result = await runInit({ yes: true, now, out: (s) => (initOut += s) });

    expect(result.wrote).toBe(true);
    expect(result.enabled).toContain('claude-code');
    expect(initOut).toContain('Calibration Egg');

    // Files exist on disk.
    expect(fs.existsSync(path.join(home, 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(home, 'state.json'))).toBe(true);
    expect(fs.existsSync(path.join(home, 'checkpoints.json'))).toBe(true);

    const config = loadConfig();
    expect(config?.adapters[0]?.provider).toBe('claude-code');
    expect(config?.adapters[0]?.cyclePolicy).toBe('dynamic');

    const state = loadState();
    expect(state).not.toBeNull();
    expect(state?.pet).toBeTruthy();

    // status output mentions the pet (name/stage/grade fields present).
    let statusOut = '';
    await statusCommand((s) => (statusOut += s), now);
    expect(statusOut).toContain('species:');
    expect(statusOut).toContain('grade:');
    expect(statusOut).toContain('stage:');
  });
});
