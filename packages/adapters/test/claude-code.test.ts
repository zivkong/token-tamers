/**
 * Fixture-based tests for the Claude Code provider adapter.
 *
 * All tests run entirely from files on disk (no network, no process spawns).
 * The fixture directory contains realistic anonymized JSONL session files.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { claudeCodeAdapter } from '../src/claude-code/index';
import type { AdapterCheckpoint } from '../src/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.join(import.meta.dirname ?? __dirname, 'fixtures', 'claude-code');

/**
 * Build a CLAUDE_CONFIG_DIR pointing at a temp dir that mirrors the fixture
 * structure (or a custom layout). Callers must clean up.
 */
async function makeTmpConfigDir(
  layout: Record<string, string>,
): Promise<{ configDir: string; cleanup: () => Promise<void> }> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tt-cc-test-'));
  const projectsDir = path.join(tmpRoot, 'projects');
  await fs.mkdir(projectsDir, { recursive: true });

  for (const [relPath, content] of Object.entries(layout)) {
    const fullPath = path.join(projectsDir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }

  const cleanup = async (): Promise<void> => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  };

  return { configDir: tmpRoot, cleanup };
}

// ---------------------------------------------------------------------------
// detect()
// ---------------------------------------------------------------------------

describe('claudeCodeAdapter.detect()', () => {
  const originalEnv = process.env['CLAUDE_CONFIG_DIR'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['CLAUDE_CONFIG_DIR'];
    } else {
      process.env['CLAUDE_CONFIG_DIR'] = originalEnv;
    }
  });

  it('returns installed:true when projects/ dir exists under CLAUDE_CONFIG_DIR', async () => {
    process.env['CLAUDE_CONFIG_DIR'] = FIXTURES_DIR;
    const result = await claudeCodeAdapter.detect();
    expect(result.installed).toBe(true);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toContain('projects');
    expect(result.warnings).toHaveLength(0);
  });

  it('returns installed:false when CLAUDE_CONFIG_DIR points at a dir with no projects/ subdir', async () => {
    const { configDir, cleanup } = await makeTmpConfigDir({});
    // Remove the projects/ dir that makeTmpConfigDir created
    await fs.rm(path.join(configDir, 'projects'), { recursive: true, force: true });

    try {
      process.env['CLAUDE_CONFIG_DIR'] = configDir;
      const result = await claudeCodeAdapter.detect();
      expect(result.installed).toBe(false);
      expect(result.paths).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it('emits a warning for an empty projects/ dir', async () => {
    const { configDir, cleanup } = await makeTmpConfigDir({});

    try {
      process.env['CLAUDE_CONFIG_DIR'] = configDir;
      const result = await claudeCodeAdapter.detect();
      expect(result.installed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toMatch(/No project directories/i);
    } finally {
      await cleanup();
    }
  });

  it('honors CLAUDE_CONFIG_DIR env var pointing at a temp dir', async () => {
    const { configDir, cleanup } = await makeTmpConfigDir({
      'proj-x/abc123.jsonl':
        [
          JSON.stringify({
            type: 'assistant',
            message: {
              role: 'assistant',
              content: 'Hi',
              model: 'claude-sonnet-4-5-20250929',
              usage: {
                input_tokens: 10,
                output_tokens: 5,
                cache_read_input_tokens: 0,
                cache_creation_input_tokens: 0,
              },
            },
            timestamp: '2024-01-01T00:00:00.000Z',
            sessionId: 'abc123',
            cwd: '/tmp/proj',
          }),
        ].join('\n') + '\n',
    });

    try {
      process.env['CLAUDE_CONFIG_DIR'] = configDir;
      const result = await claudeCodeAdapter.detect();
      expect(result.installed).toBe(true);
      expect(result.paths[0]).toBe(path.join(configDir, 'projects'));
      expect(result.warnings).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// scan() — full extraction from fixtures
// ---------------------------------------------------------------------------

describe('claudeCodeAdapter.scan() — fixture files', () => {
  it('extracts UsageEvents from a main session file', async () => {
    const projectsDir = path.join(FIXTURES_DIR, 'projects');
    const result = await claudeCodeAdapter.scan([projectsDir]);

    // The fixtures contain assistant records with usage — we should get some events.
    expect(result.events.length).toBeGreaterThan(0);

    // All events must have the correct adapter id.
    for (const ev of result.events) {
      expect(ev.adapter).toBe('claude-code');
    }
  });

  it('sets isSubagent=false for main session files', async () => {
    const projectsDir = path.join(FIXTURES_DIR, 'projects');
    const result = await claudeCodeAdapter.scan([projectsDir]);

    const mainEvents = result.events.filter(
      (ev) => ev.sessionKey === '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(mainEvents.length).toBeGreaterThan(0);
    for (const ev of mainEvents) {
      expect(ev.isSubagent).toBe(false);
    }
  });

  it('sets isSubagent=true for agent- prefixed files', async () => {
    const projectsDir = path.join(FIXTURES_DIR, 'projects');
    const result = await claudeCodeAdapter.scan([projectsDir]);

    const agentEvents = result.events.filter(
      (ev) => ev.sessionKey === '661e8511-f30c-52e5-b827-557766551111',
    );
    expect(agentEvents.length).toBeGreaterThan(0);
    for (const ev of agentEvents) {
      expect(ev.isSubagent).toBe(true);
    }
  });

  it('parses cacheReadTokens and cacheWriteTokens correctly', async () => {
    const projectsDir = path.join(FIXTURES_DIR, 'projects');
    const result = await claudeCodeAdapter.scan([projectsDir]);

    // The fixture has records with non-zero cache fields.
    const withCacheRead = result.events.filter((ev) => ev.cacheReadTokens > 0);
    expect(withCacheRead.length).toBeGreaterThan(0);

    const withCacheWrite = result.events.filter((ev) => ev.cacheWriteTokens > 0);
    expect(withCacheWrite.length).toBeGreaterThan(0);
  });

  it('preserves cwd from fixture records', async () => {
    const projectsDir = path.join(FIXTURES_DIR, 'projects');
    const result = await claudeCodeAdapter.scan([projectsDir]);

    const withCwd = result.events.filter((ev) => ev.cwd !== undefined);
    expect(withCwd.length).toBeGreaterThan(0);
    expect(withCwd[0]!.cwd).toBe('/home/dev/my-project');
  });

  it('does not duplicate events — skips records without usage', async () => {
    const projectsDir = path.join(FIXTURES_DIR, 'projects');
    const result = await claudeCodeAdapter.scan([projectsDir]);

    // User-type and non-assistant records must not produce events.
    // We know the fixture has user records; verify none leak through.
    for (const ev of result.events) {
      // Every event must come from an assistant record with model + usage.
      expect(ev.modelId).toBeTruthy();
      expect(typeof ev.inputTokens).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// scan() — malformed line tolerance
// ---------------------------------------------------------------------------

describe('claudeCodeAdapter.scan() — malformed line tolerance', () => {
  // The fixture 772f9622 file contains a malformed trailing line.
  // We use the fixtures directory directly in these tests.

  it('skips malformed/partial trailing lines without throwing', async () => {
    const projectsDir = path.join(FIXTURES_DIR, 'projects');
    // Should not throw; the malformed line in encoded-path-def456 is silently skipped.
    await expect(claudeCodeAdapter.scan([projectsDir])).resolves.toBeDefined();
  });

  it('still emits events from valid lines in a file with a malformed trailing line', async () => {
    const projectsDir = path.join(FIXTURES_DIR, 'projects');
    const result = await claudeCodeAdapter.scan([projectsDir]);

    // The file with the malformed line (772f9622) also has valid assistant records.
    const sessionEvents = result.events.filter(
      (ev) => ev.sessionKey === '772f9622-g41d-63f6-c938-668877662222',
    );
    expect(sessionEvents.length).toBeGreaterThan(0);
  });

  it('handles completely malformed lines embedded in otherwise-valid content', async () => {
    const sessionId = 'aaaa1111-bbbb-2222-cccc-333344445555';
    const lines =
      [
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: 'ok',
            model: 'claude-haiku-4-5-20251001',
            usage: {
              input_tokens: 10,
              output_tokens: 5,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
            },
          },
          timestamp: '2024-06-01T00:00:00.000Z',
          sessionId,
          cwd: '/tmp/x',
        }),
        'NOT_VALID_JSON{{{',
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: 'also ok',
            model: 'claude-haiku-4-5-20251001',
            usage: {
              input_tokens: 20,
              output_tokens: 8,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
            },
          },
          timestamp: '2024-06-01T00:01:00.000Z',
          sessionId,
          cwd: '/tmp/x',
        }),
      ].join('\n') + '\n';

    const { configDir: tmpDir, cleanup: tmpCleanup } = await makeTmpConfigDir({
      [`proj-a/${sessionId}.jsonl`]: lines,
    });

    try {
      process.env['CLAUDE_CONFIG_DIR'] = tmpDir;
      const result = await claudeCodeAdapter.scan([path.join(tmpDir, 'projects')]);
      // Only the two valid events should be present; the bad line is skipped.
      const evts = result.events.filter((ev) => ev.sessionKey === sessionId);
      expect(evts).toHaveLength(2);
    } finally {
      delete process.env['CLAUDE_CONFIG_DIR'];
      await tmpCleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// scan() — incremental checkpoint (no duplicates on re-scan)
// ---------------------------------------------------------------------------

describe('claudeCodeAdapter.scan() — incremental checkpoint', () => {
  it('returns a non-empty checkpoint after the first scan', async () => {
    const projectsDir = path.join(FIXTURES_DIR, 'projects');
    const result = await claudeCodeAdapter.scan([projectsDir]);
    expect(Object.keys(result.checkpoint.files).length).toBeGreaterThan(0);
  });

  it('returns zero events on re-scan with an up-to-date checkpoint', async () => {
    const projectsDir = path.join(FIXTURES_DIR, 'projects');

    // First scan to build checkpoint.
    const first = await claudeCodeAdapter.scan([projectsDir]);
    expect(first.events.length).toBeGreaterThan(0);

    // Second scan with the same checkpoint — all files unchanged, no new events.
    const second = await claudeCodeAdapter.scan([projectsDir], first.checkpoint);
    expect(second.events).toHaveLength(0);
  });

  it('picks up only newly appended lines after the checkpoint offset', async () => {
    const sessionId = 'dddd1111-eeee-2222-ffff-000011112222';
    const initialLine =
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'first',
          model: 'claude-sonnet-4-5-20250929',
          usage: {
            input_tokens: 50,
            output_tokens: 25,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        },
        timestamp: '2024-05-01T08:00:00.000Z',
        sessionId,
        cwd: '/tmp/work',
      }) + '\n';

    const appendedLine =
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'second',
          model: 'claude-sonnet-4-5-20250929',
          usage: {
            input_tokens: 80,
            output_tokens: 40,
            cache_read_input_tokens: 500,
            cache_creation_input_tokens: 0,
          },
        },
        timestamp: '2024-05-01T08:01:00.000Z',
        sessionId,
        cwd: '/tmp/work',
      }) + '\n';

    const { configDir, cleanup } = await makeTmpConfigDir({
      [`proj-b/${sessionId}.jsonl`]: initialLine,
    });

    const filePath = path.join(configDir, 'projects', 'proj-b', `${sessionId}.jsonl`);

    try {
      process.env['CLAUDE_CONFIG_DIR'] = configDir;

      // First scan — sees only the initial line.
      const first = await claudeCodeAdapter.scan([path.join(configDir, 'projects')]);
      expect(first.events.filter((ev) => ev.sessionKey === sessionId)).toHaveLength(1);
      expect(first.events.find((ev) => ev.sessionKey === sessionId)?.inputTokens).toBe(50);

      // Simulate the file being appended (mtime advances on append).
      await fs.appendFile(filePath, appendedLine, 'utf8');
      // Manually update mtime so the adapter re-reads even if the OS rounds it.
      const now = Date.now();
      await fs.utimes(filePath, now / 1000, now / 1000 + 1);

      // Build a checkpoint that forces re-read by clearing the mtime cache.
      // Real usage: just pass first.checkpoint — the offset prevents duplicate reads.
      const checkpointWithFreshMtime: AdapterCheckpoint = {
        files: {
          [filePath]: {
            offset: first.checkpoint.files[filePath]?.offset ?? 0,
            mtimeMs: 0, // Force re-check by making mtime appear changed.
          },
        },
      };

      // Second scan — should see only the appended line, not the first one.
      const second = await claudeCodeAdapter.scan(
        [path.join(configDir, 'projects')],
        checkpointWithFreshMtime,
      );

      const newEvents = second.events.filter((ev) => ev.sessionKey === sessionId);
      expect(newEvents).toHaveLength(1);
      expect(newEvents[0]!.inputTokens).toBe(80);
    } finally {
      delete process.env['CLAUDE_CONFIG_DIR'];
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// scan() — lang hints extraction
// ---------------------------------------------------------------------------

describe('claudeCodeAdapter.scan() — lang hints', () => {
  it('extracts file extension hints from tool_use input paths', async () => {
    const sessionId = 'gggg1111-hhhh-2222-iiii-000022223333';
    const content =
      [
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'toolu_x',
                name: 'Read',
                input: {
                  file_path: '/home/dev/project/src/main.ts',
                },
              },
              {
                type: 'tool_use',
                id: 'toolu_y',
                name: 'Edit',
                input: {
                  file_path: '/home/dev/project/src/utils.py',
                },
              },
            ],
            model: 'claude-sonnet-4-5-20250929',
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
            },
          },
          timestamp: '2024-04-01T10:00:00.000Z',
          sessionId,
          cwd: '/home/dev/project',
        }),
      ].join('\n') + '\n';

    const { configDir, cleanup } = await makeTmpConfigDir({
      [`proj-c/${sessionId}.jsonl`]: content,
    });

    try {
      process.env['CLAUDE_CONFIG_DIR'] = configDir;
      const result = await claudeCodeAdapter.scan([path.join(configDir, 'projects')]);
      const ev = result.events.find((e) => e.sessionKey === sessionId);
      expect(ev).toBeDefined();
      expect(ev!.langHints).toBeDefined();
      expect(ev!.langHints).toContain('.ts');
      expect(ev!.langHints).toContain('.py');
    } finally {
      delete process.env['CLAUDE_CONFIG_DIR'];
      await cleanup();
    }
  });

  it('omits langHints when content is not an array of tool_use blocks', async () => {
    const sessionId = 'jjjj1111-kkkk-2222-llll-000033334444';
    const content =
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Just some text, no tool calls.',
          model: 'claude-haiku-4-5-20251001',
          usage: {
            input_tokens: 30,
            output_tokens: 15,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        },
        timestamp: '2024-04-02T11:00:00.000Z',
        sessionId,
        cwd: '/tmp',
      }) + '\n';

    const { configDir, cleanup } = await makeTmpConfigDir({
      [`proj-d/${sessionId}.jsonl`]: content,
    });

    try {
      process.env['CLAUDE_CONFIG_DIR'] = configDir;
      const result = await claudeCodeAdapter.scan([path.join(configDir, 'projects')]);
      const ev = result.events.find((e) => e.sessionKey === sessionId);
      expect(ev).toBeDefined();
      expect(ev!.langHints).toBeUndefined();
    } finally {
      delete process.env['CLAUDE_CONFIG_DIR'];
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// scan() — non-assistant records are skipped
// ---------------------------------------------------------------------------

describe('claudeCodeAdapter.scan() — record type filtering', () => {
  it('skips user-type records and produces no events for them', async () => {
    const sessionId = 'mmmm1111-nnnn-2222-oooo-000044445555';
    const content =
      [
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'hello' },
          timestamp: '2024-04-03T12:00:00.000Z',
          sessionId,
          cwd: '/tmp',
        }),
        JSON.stringify({
          type: 'system',
          message: { role: 'system', content: 'System init' },
          timestamp: '2024-04-03T12:00:01.000Z',
          sessionId,
          cwd: '/tmp',
        }),
      ].join('\n') + '\n';

    const { configDir, cleanup } = await makeTmpConfigDir({
      [`proj-e/${sessionId}.jsonl`]: content,
    });

    try {
      process.env['CLAUDE_CONFIG_DIR'] = configDir;
      const result = await claudeCodeAdapter.scan([path.join(configDir, 'projects')]);
      const evts = result.events.filter((ev) => ev.sessionKey === sessionId);
      expect(evts).toHaveLength(0);
    } finally {
      delete process.env['CLAUDE_CONFIG_DIR'];
      await cleanup();
    }
  });

  it('skips assistant records that have no usage field', async () => {
    const sessionId = 'pppp1111-qqqq-2222-rrrr-000055556666';
    const content =
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'No usage here',
          model: 'claude-sonnet-4-5-20250929',
          // usage is intentionally absent
        },
        timestamp: '2024-04-04T13:00:00.000Z',
        sessionId,
        cwd: '/tmp',
      }) + '\n';

    const { configDir, cleanup } = await makeTmpConfigDir({
      [`proj-f/${sessionId}.jsonl`]: content,
    });

    try {
      process.env['CLAUDE_CONFIG_DIR'] = configDir;
      const result = await claudeCodeAdapter.scan([path.join(configDir, 'projects')]);
      const evts = result.events.filter((ev) => ev.sessionKey === sessionId);
      expect(evts).toHaveLength(0);
    } finally {
      delete process.env['CLAUDE_CONFIG_DIR'];
      await cleanup();
    }
  });
});
