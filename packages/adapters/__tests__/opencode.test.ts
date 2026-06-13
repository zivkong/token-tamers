/**
 * Tests for the OpenCode provider adapter.
 *
 * SQLite tests: build a tiny fixture db at runtime in a temp dir using
 * node:sqlite. The whole SQLite suite is guarded with a capability check
 * and skipped cleanly when node:sqlite is unavailable (Node < 22.5).
 *
 * Legacy-tree tests: static JSON fixtures under __tests__/fixtures/opencode/.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openCodeAdapter } from '../src/opencode/index';
import { parseMessageRow, parseLegacyMessageFile } from '../src/opencode/parse';

// ---------------------------------------------------------------------------
// Capability check — skip all SQLite tests when node:sqlite is unavailable
// ---------------------------------------------------------------------------

let sqliteAvailable = false;
let DatabaseSync: (typeof import('node:sqlite'))['DatabaseSync'] | null = null;

beforeAll(async () => {
  try {
    const mod = await import('node:sqlite');
    DatabaseSync = mod.DatabaseSync;
    sqliteAvailable = true;
  } catch {
    sqliteAvailable = false;
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.join(import.meta.dirname ?? __dirname, 'fixtures', 'opencode');

interface TmpDb {
  dbPath: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a minimal OpenCode-like SQLite db in a temp dir.
 * Matches the real schema: session(id, parent_id, ...), message(id, session_id,
 * time_created, time_updated, data JSON).
 */
async function makeTmpDb(): Promise<TmpDb> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tt-oc-test-'));
  const dbPath = path.join(tmpDir, 'opencode.db');

  // Use synchronous DatabaseSync since it's available here
  const db = new DatabaseSync!(dbPath);
  db.exec(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      parent_id TEXT,
      time_created INTEGER,
      time_updated INTEGER
    )
  `);
  db.exec(`
    CREATE TABLE message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    )
  `);

  db.exec(`
    INSERT INTO session (id, project_id, parent_id, time_created, time_updated) VALUES
      ('sess-main-001', 'proj-abc', NULL, 1000, 2000),
      ('sess-sub-001',  'proj-abc', 'sess-main-001', 1100, 2100)
  `);

  // Completed assistant message — main session
  db.exec(`
    INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
    ('msg-001', 'sess-main-001', 1500, 1600,
      '{"role":"assistant","modelID":"deepseek-v4-pro","providerID":"deepseek","path":{"cwd":"/home/dev/proj"},"tokens":{"total":44908,"input":424,"output":147,"reasoning":49,"cache":{"write":0,"read":44288}},"time":{"created":1500,"completed":1600},"finish":"tool-calls"}')
  `);

  // Streaming (incomplete) assistant message — must be excluded
  db.exec(`
    INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
    ('msg-002', 'sess-main-001', 1700, 1800,
      '{"role":"assistant","modelID":"deepseek-v4-pro","providerID":"deepseek","path":{"cwd":"/home/dev/proj"},"tokens":{"total":0,"input":0,"output":0,"reasoning":0,"cache":{"write":0,"read":0}},"time":{"created":1700},"finish":""}')
  `);

  // User message — must be excluded
  db.exec(`
    INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
    ('msg-003', 'sess-main-001', 1900, 2000,
      '{"role":"user","content":"Hello","time":{"created":1900,"completed":1950}}')
  `);

  // Completed assistant message — subagent session
  db.exec(`
    INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
    ('msg-004', 'sess-sub-001', 2100, 2200,
      '{"role":"assistant","modelID":"claude-sonnet-4-6","providerID":"anthropic","path":{"cwd":"/home/dev/proj/sub"},"tokens":{"total":1000,"input":200,"output":100,"reasoning":0,"cache":{"write":50,"read":650}},"time":{"created":2100,"completed":2200},"finish":"end-turn"}')
  `);

  // Malformed data JSON — must be skipped without throwing
  db.exec(`
    INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
    ('msg-005', 'sess-main-001', 2300, 2400, 'NOT_VALID_JSON{{{')
  `);

  db.close();

  const cleanup = async (): Promise<void> => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  };

  return { dbPath, cleanup };
}

// ---------------------------------------------------------------------------
// Pure parse unit tests (no I/O, run regardless of sqlite availability)
// ---------------------------------------------------------------------------

describe('parseMessageRow — unit', () => {
  it('maps completed assistant row to UsageEvent with correct fields', () => {
    const row = {
      id: 'msg-001',
      session_id: 'sess-main-001',
      time_created: 1500,
      time_updated: 1600,
      parent_id: null,
      data: JSON.stringify({
        role: 'assistant',
        modelID: 'deepseek-v4-pro',
        path: { cwd: '/home/dev' },
        tokens: { input: 424, output: 147, reasoning: 49, cache: { write: 0, read: 44288 } },
        time: { created: 1500, completed: 1600 },
      }),
    };

    const event = parseMessageRow(row);
    expect(event).toBeDefined();
    expect(event!.adapter).toBe('opencode');
    expect(event!.modelId).toBe('deepseek-v4-pro');
    expect(event!.ts).toBe(1600);
    expect(event!.inputTokens).toBe(424);
    // output + reasoning = 147 + 49 = 196
    expect(event!.outputTokens).toBe(196);
    expect(event!.cacheReadTokens).toBe(44288);
    expect(event!.cacheWriteTokens).toBe(0);
    expect(event!.sessionKey).toBe('sess-main-001');
    expect(event!.isSubagent).toBe(false);
    expect(event!.cwd).toBe('/home/dev');
  });

  it('sets isSubagent=true when parent_id is non-null', () => {
    const row = {
      id: 'msg-002',
      session_id: 'sess-sub-001',
      time_created: 2000,
      time_updated: 2100,
      parent_id: 'sess-main-001',
      data: JSON.stringify({
        role: 'assistant',
        modelID: 'claude-sonnet-4-6',
        tokens: { input: 10, output: 5, reasoning: 0, cache: { write: 0, read: 0 } },
        time: { created: 2000, completed: 2100 },
      }),
    };

    const event = parseMessageRow(row);
    expect(event).toBeDefined();
    expect(event!.isSubagent).toBe(true);
  });

  it('excludes streaming (incomplete) messages without time.completed', () => {
    const row = {
      id: 'msg-stream',
      session_id: 'sess-main-001',
      time_created: 1700,
      time_updated: 1800,
      parent_id: null,
      data: JSON.stringify({
        role: 'assistant',
        modelID: 'deepseek-v4-pro',
        tokens: { input: 0, output: 0, reasoning: 0, cache: { write: 0, read: 0 } },
        time: { created: 1700 },
      }),
    };

    const event = parseMessageRow(row);
    expect(event).toBeUndefined();
  });

  it('excludes user messages', () => {
    const row = {
      id: 'msg-user',
      session_id: 'sess-main-001',
      time_created: 1900,
      time_updated: 2000,
      parent_id: null,
      data: JSON.stringify({ role: 'user', content: 'hello', time: { completed: 2000 } }),
    };

    const event = parseMessageRow(row);
    expect(event).toBeUndefined();
  });

  it('returns undefined for malformed data JSON without throwing', () => {
    const row = {
      id: 'msg-bad',
      session_id: 'sess-main-001',
      time_created: 2300,
      time_updated: 2400,
      parent_id: null,
      data: 'NOT_VALID_JSON{{{',
    };

    expect(() => parseMessageRow(row)).not.toThrow();
    expect(parseMessageRow(row)).toBeUndefined();
  });

  it('omits cwd when path is absent', () => {
    const row = {
      id: 'msg-nocwd',
      session_id: 'sess-x',
      time_created: 100,
      time_updated: 200,
      parent_id: null,
      data: JSON.stringify({
        role: 'assistant',
        modelID: 'gpt-4o',
        tokens: { input: 10, output: 5, cache: { write: 0, read: 0 } },
        time: { created: 100, completed: 200 },
      }),
    };

    const event = parseMessageRow(row);
    expect(event).toBeDefined();
    expect(event!.cwd).toBeUndefined();
  });
});

describe('parseLegacyMessageFile — unit', () => {
  it('maps completed assistant legacy file to UsageEvent', () => {
    const raw = {
      id: 'msg-001',
      sessionID: 'sess-aaa-111',
      role: 'assistant',
      modelID: 'deepseek-v4-pro',
      path: { cwd: '/home/dev/my-project' },
      tokens: { input: 424, output: 147, reasoning: 49, cache: { write: 0, read: 44288 } },
      time: { created: 1781268901895, completed: 1781268905095 },
    };

    const event = parseLegacyMessageFile(raw, 'sess-aaa-111', false);
    expect(event).toBeDefined();
    expect(event!.adapter).toBe('opencode');
    expect(event!.modelId).toBe('deepseek-v4-pro');
    expect(event!.ts).toBe(1781268905095);
    expect(event!.inputTokens).toBe(424);
    expect(event!.outputTokens).toBe(196); // 147 + 49
    expect(event!.cacheReadTokens).toBe(44288);
    expect(event!.isSubagent).toBe(false);
    expect(event!.cwd).toBe('/home/dev/my-project');
  });

  it('sets isSubagent from caller parameter', () => {
    const raw = {
      role: 'assistant',
      modelID: 'claude-sonnet-4-6',
      tokens: { input: 10, output: 5, cache: { write: 0, read: 0 } },
      time: { created: 100, completed: 200 },
    };

    const event = parseLegacyMessageFile(raw, 'sess-sub', true);
    expect(event).toBeDefined();
    expect(event!.isSubagent).toBe(true);
  });

  it('excludes incomplete legacy messages', () => {
    const raw = {
      role: 'assistant',
      modelID: 'some-model',
      tokens: { input: 0, output: 0, cache: { write: 0, read: 0 } },
      time: { created: 100 },
    };

    expect(parseLegacyMessageFile(raw, 'sess-x', false)).toBeUndefined();
  });

  it('returns undefined for non-object input without throwing', () => {
    expect(() => parseLegacyMessageFile('bad', 'sess-x', false)).not.toThrow();
    expect(parseLegacyMessageFile('bad', 'sess-x', false)).toBeUndefined();
    expect(parseLegacyMessageFile(null, 'sess-x', false)).toBeUndefined();
    expect(parseLegacyMessageFile(42, 'sess-x', false)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SQLite integration tests
// ---------------------------------------------------------------------------

describe('openCodeAdapter SQLite scan', () => {
  let tmpDb: TmpDb | undefined;

  beforeEach(async () => {
    if (!sqliteAvailable) return;
    tmpDb = await makeTmpDb();
  });

  afterEach(async () => {
    if (tmpDb) {
      await tmpDb.cleanup();
      tmpDb = undefined;
    }
  });

  it('extracts completed assistant events and excludes streaming/user/malformed rows', async () => {
    if (!sqliteAvailable) return;

    const root = path.dirname(tmpDb!.dbPath);
    const result = await openCodeAdapter.scan([root]);

    // msg-001 (main, completed) + msg-004 (subagent, completed) = 2 events
    expect(result.events).toHaveLength(2);

    for (const ev of result.events) {
      expect(ev.adapter).toBe('opencode');
    }
  });

  it('maps token fields correctly including reasoning summed into outputTokens', async () => {
    if (!sqliteAvailable) return;

    const root = path.dirname(tmpDb!.dbPath);
    const result = await openCodeAdapter.scan([root]);

    const mainEv = result.events.find((e) => e.sessionKey === 'sess-main-001');
    expect(mainEv).toBeDefined();
    expect(mainEv!.modelId).toBe('deepseek-v4-pro');
    expect(mainEv!.inputTokens).toBe(424);
    expect(mainEv!.outputTokens).toBe(196); // 147 + 49 reasoning
    expect(mainEv!.cacheReadTokens).toBe(44288);
    expect(mainEv!.cacheWriteTokens).toBe(0);
    expect(mainEv!.cwd).toBe('/home/dev/proj');
  });

  it('tags subagent sessions with isSubagent=true', async () => {
    if (!sqliteAvailable) return;

    const root = path.dirname(tmpDb!.dbPath);
    const result = await openCodeAdapter.scan([root]);

    const subEv = result.events.find((e) => e.sessionKey === 'sess-sub-001');
    expect(subEv).toBeDefined();
    expect(subEv!.isSubagent).toBe(true);

    const mainEv = result.events.find((e) => e.sessionKey === 'sess-main-001');
    expect(mainEv).toBeDefined();
    expect(mainEv!.isSubagent).toBe(false);
  });

  it('returns a checkpoint after first scan', async () => {
    if (!sqliteAvailable) return;

    const root = path.dirname(tmpDb!.dbPath);
    const result = await openCodeAdapter.scan([root]);
    expect(Object.keys(result.checkpoint.files).length).toBeGreaterThan(0);

    const dbKey = tmpDb!.dbPath;
    expect(result.checkpoint.files[dbKey]).toBeDefined();
    expect(result.checkpoint.files[dbKey]!.offset).toBeGreaterThan(0);
  });

  it('returns no duplicates on incremental rescan with same cursor', async () => {
    if (!sqliteAvailable) return;

    const root = path.dirname(tmpDb!.dbPath);

    // First scan
    const first = await openCodeAdapter.scan([root]);
    expect(first.events.length).toBeGreaterThan(0);

    // Second scan with the same checkpoint — cursor should prevent re-reading
    const second = await openCodeAdapter.scan([root], first.checkpoint);
    expect(second.events).toHaveLength(0);
  });

  it('picks up new rows inserted after the first scan', async () => {
    if (!sqliteAvailable) return;

    const root = path.dirname(tmpDb!.dbPath);

    // First scan
    const first = await openCodeAdapter.scan([root]);
    const firstCount = first.events.length;

    // Insert a new completed message with a later time_updated
    const db = new DatabaseSync!(tmpDb!.dbPath);
    db.exec(`
      INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES
      ('msg-new', 'sess-main-001', 9000, 9100,
        '{"role":"assistant","modelID":"gpt-4o","providerID":"openai","path":{"cwd":"/home/dev"},"tokens":{"total":100,"input":50,"output":30,"reasoning":5,"cache":{"write":10,"read":5}},"time":{"created":9000,"completed":9100},"finish":"end-turn"}')
    `);
    db.close();

    // Second scan with checkpoint from first — should only see the new row
    const second = await openCodeAdapter.scan([root], first.checkpoint);
    expect(second.events).toHaveLength(1);
    expect(second.events[0]!.modelId).toBe('gpt-4o');
    expect(second.events[0]!.inputTokens).toBe(50);
    // 30 + 5 reasoning
    expect(second.events[0]!.outputTokens).toBe(35);

    // Combined total should equal firstCount + 1
    expect(firstCount + second.events.length).toBe(firstCount + 1);
  });

  it('handles locked/missing db gracefully — returns empty events', async () => {
    if (!sqliteAvailable) return;

    // Point at a non-existent db path
    const root = path.join(os.tmpdir(), 'tt-oc-missing-' + Date.now().toString());
    await fs.mkdir(root, { recursive: true });

    try {
      const result = await openCodeAdapter.scan([root]);
      expect(result.events).toHaveLength(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// detect() tests
// ---------------------------------------------------------------------------

describe('openCodeAdapter.detect()', () => {
  it('returns installed:true when the given root has opencode.db', async () => {
    if (!sqliteAvailable) return;

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tt-oc-detect-'));
    const dbPath = path.join(tmpDir, 'opencode.db');

    try {
      // Create minimal db so the file exists
      const db = new DatabaseSync!(dbPath);
      db.exec('CREATE TABLE session (id TEXT)');
      db.close();

      const result = await openCodeAdapter.detect([tmpDir]);

      expect(result.installed).toBe(true);
      expect(result.paths).toContain(tmpDir);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns installed:true when the given root has a legacy storage/message/ tree', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tt-oc-detect-legacy-'));

    try {
      await fs.mkdir(path.join(tmpDir, 'storage', 'message'), { recursive: true });

      const result = await openCodeAdapter.detect([tmpDir]);

      expect(result.installed).toBe(true);
      expect(result.paths).toContain(tmpDir);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns installed:false when dir exists but has neither db nor legacy tree', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tt-oc-detect-empty-'));

    try {
      const result = await openCodeAdapter.detect([tmpDir]);

      expect(result.installed).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns installed:false when the given root is a nonexistent path', async () => {
    const result = await openCodeAdapter.detect(['/nonexistent/path/for/tt/test']);
    expect(result.installed).toBe(false);
    expect(result.paths).toHaveLength(0);
  });

  it('supports multiple roots passed in', async () => {
    if (!sqliteAvailable) return;

    const tmpDir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'tt-oc-multi1-'));
    const tmpDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'tt-oc-multi2-'));

    try {
      // dir1 has a db, dir2 has legacy tree
      const db = new DatabaseSync!(path.join(tmpDir1, 'opencode.db'));
      db.exec('CREATE TABLE session (id TEXT)');
      db.close();

      await fs.mkdir(path.join(tmpDir2, 'storage', 'message'), { recursive: true });

      const result = await openCodeAdapter.detect([tmpDir1, tmpDir2]);

      expect(result.installed).toBe(true);
      expect(result.paths).toContain(tmpDir1);
      expect(result.paths).toContain(tmpDir2);
    } finally {
      await fs.rm(tmpDir1, { recursive: true, force: true });
      await fs.rm(tmpDir2, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Legacy JSON tree scan tests (static fixtures)
// ---------------------------------------------------------------------------

describe('openCodeAdapter legacy tree scan (fixtures)', () => {
  it('extracts UsageEvents from the legacy fixture tree', async () => {
    const result = await openCodeAdapter.scan([FIXTURES_DIR]);

    // Fixtures have 2 completed assistant messages
    const ocEvents = result.events.filter((e) => e.adapter === 'opencode');
    expect(ocEvents.length).toBeGreaterThan(0);
  });

  it('correctly parses the deepseek fixture including reasoning tokens', async () => {
    const result = await openCodeAdapter.scan([FIXTURES_DIR]);

    const deepseekEv = result.events.find(
      (e) => e.sessionKey === 'sess-aaa-111' && e.modelId === 'deepseek-v4-pro',
    );
    expect(deepseekEv).toBeDefined();
    expect(deepseekEv!.inputTokens).toBe(424);
    expect(deepseekEv!.outputTokens).toBe(196); // 147 + 49 reasoning
    expect(deepseekEv!.cacheReadTokens).toBe(44288);
    expect(deepseekEv!.ts).toBe(1781268905095);
    expect(deepseekEv!.cwd).toBe('/home/dev/my-project');
    expect(deepseekEv!.isSubagent).toBe(false);
  });

  it('tags subagent sessions from parentID in legacy files', async () => {
    const result = await openCodeAdapter.scan([FIXTURES_DIR]);

    const subEv = result.events.find(
      (e) => e.sessionKey === 'sess-bbb-222' && e.modelId === 'claude-sonnet-4-6',
    );
    expect(subEv).toBeDefined();
    expect(subEv!.isSubagent).toBe(true);
  });

  it('returns no duplicates on re-scan with an up-to-date checkpoint', async () => {
    const first = await openCodeAdapter.scan([FIXTURES_DIR]);
    expect(first.events.length).toBeGreaterThan(0);

    const second = await openCodeAdapter.scan([FIXTURES_DIR], first.checkpoint);
    expect(second.events).toHaveLength(0);
  });

  it('prunes checkpoint entries for legacy files the user has deleted', async () => {
    // Copy the fixture tree to a temp root we are allowed to delete from.
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tt-oc-prune-'));
    try {
      await fs.cp(path.join(FIXTURES_DIR, 'storage'), path.join(tmpRoot, 'storage'), {
        recursive: true,
      });
      const first = await openCodeAdapter.scan([tmpRoot]);
      const sessADir = path.join(tmpRoot, 'storage', 'message', 'sess-aaa-111');
      const keptFile = path.join(tmpRoot, 'storage', 'message', 'sess-bbb-222', 'msg-001.json');
      expect(Object.keys(first.checkpoint.files).some((k) => k.startsWith(sessADir))).toBe(true);

      // The user prunes one session from OpenCode storage.
      await fs.rm(sessADir, { recursive: true, force: true });

      const second = await openCodeAdapter.scan([tmpRoot], first.checkpoint);
      expect(second.events).toHaveLength(0); // nothing re-read, nothing duplicated
      expect(Object.keys(second.checkpoint.files).some((k) => k.startsWith(sessADir))).toBe(false);
      expect(second.checkpoint.files[keptFile]).toEqual(first.checkpoint.files[keptFile]);
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// defaultPlan field
// ---------------------------------------------------------------------------

describe('openCodeAdapter metadata', () => {
  it('exposes defaultPlan as "api"', () => {
    expect(openCodeAdapter.defaultPlan).toBe('api');
  });

  it('has the correct adapter id', () => {
    expect(openCodeAdapter.id).toBe('opencode');
  });
});
