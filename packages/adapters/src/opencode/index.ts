/**
 * OpenCode provider adapter.
 *
 * Primary source: ~/.local/share/opencode/opencode.db (SQLite, WAL mode).
 * Verified June 2026 against OpenCode v1.17.4.
 *
 * Legacy fallback: storage/message/{sessionID}/msg_*.json single-JSON files
 * for older OpenCode builds that predate the SQLite migration.
 *
 * Read-only, always. Never writes inside the provider dir.
 * node:sqlite is experimental in Node 22.x — loaded lazily via dynamic import
 * so this module does NOT crash on Node < 22.5 where the builtin is absent.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { UsageEvent } from '@token-tamers/core';
import type { AdapterCheckpoint, AdapterDetection, ProviderAdapter, ScanResult } from '../index';
import { safeJsonParse } from '../helpers/jsonl';
import { ADAPTER_ID, parseLegacyMessageFile, parseMessageRow, type MessageRow } from './parse';

// ---------------------------------------------------------------------------
// Data dir resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the list of OpenCode data roots.
 *
 * Precedence:
 *   1. OPENCODE_DATA_DIR env var (comma-separated, supports multiple roots)
 *   2. $XDG_DATA_HOME/opencode when XDG_DATA_HOME is set
 *   3. ~/.local/share/opencode (Linux/macOS default)
 *
 * Returns an array (always at least one path even if it does not exist yet).
 */
function resolveDataRoots(): string[] {
  const envOverride = process.env['OPENCODE_DATA_DIR'];
  if (envOverride) {
    return envOverride
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  const xdgDataHome = process.env['XDG_DATA_HOME'];
  if (xdgDataHome) {
    return [path.join(xdgDataHome, 'opencode')];
  }

  return [path.join(os.homedir(), '.local', 'share', 'opencode')];
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

/** Stat a path; return null if it does not exist or is inaccessible. */
async function statOrNull(p: string): Promise<{ mtimeMs: number; isDirectory(): boolean } | null> {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

/** Return true when a file exists at `p`. */
async function fileExists(p: string): Promise<boolean> {
  const s = await statOrNull(p);
  return s !== null && !s.isDirectory();
}

/** Safely read a directory; returns [] on error. */
async function readdirSafe(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// node:sqlite capability probe
// ---------------------------------------------------------------------------

/** Lazy-loaded DatabaseSync constructor; null when node:sqlite is unavailable. */
let sqliteCapable: boolean | null = null;

/**
 * Probe whether node:sqlite is usable on this Node version.
 * Returns the DatabaseSync class, or null when the builtin is absent (< 22.5).
 * The result is cached after the first probe.
 */
async function getDatabaseSync(): Promise<(typeof import('node:sqlite'))['DatabaseSync'] | null> {
  if (sqliteCapable === false) return null;

  try {
    // Indirect specifier: esbuild (tsup, target node20) rewrites a literal
    // import('node:sqlite') — a builtin newer than its node20 list — into a
    // broken import('sqlite'). A non-literal specifier is left untouched.
    const specifier = 'node:sqlite';
    const mod = (await import(specifier)) as typeof import('node:sqlite');
    sqliteCapable = true;
    return mod.DatabaseSync;
  } catch {
    sqliteCapable = false;
    return null;
  }
}

// ---------------------------------------------------------------------------
// SQLite scan
// ---------------------------------------------------------------------------

/**
 * Query the OpenCode SQLite database for new assistant messages.
 *
 * Checkpoint reuse: the `offset` field in AdapterCheckpoint.files is repurposed
 * as a time_updated cursor (not a byte offset — commented here to be explicit).
 * We advance it to the max time_updated of the batch so subsequent scans only
 * fetch rows that are newer.
 *
 * WAL caveat: WAL writes do NOT touch the main db file's mtime — we therefore
 * do NOT skip scanning on equal mtime (unlike JSONL files). We always query
 * using the time_updated cursor instead.
 *
 * Known accepted edge: if a completed message row is later updated (e.g. by an
 * OpenCode background sync), it would re-emit. In practice, completed messages
 * are effectively immutable in the OpenCode store. The inverse edge also
 * exists: the strictly-greater cursor would permanently skip a new row whose
 * time_updated EQUALS the stored cursor — vanishingly rare at ms resolution;
 * revisit with a (time_updated, id) composite cursor if OpenCode is ever
 * observed batch-writing identical time_updated values.
 */
async function scanSqliteDb(
  dbPath: string,
  checkpoint: AdapterCheckpoint,
  DatabaseSync: (typeof import('node:sqlite'))['DatabaseSync'],
): Promise<{ events: UsageEvent[]; newCursor: number; mtimeMs: number }> {
  const st = await statOrNull(dbPath);
  if (!st) return { events: [], newCursor: 0, mtimeMs: 0 };

  const prev = checkpoint.files[dbPath];
  // `offset` is repurposed as a time_updated cursor (integer epoch ms from
  // the db), not a byte offset. The checkpoint shape is reused for uniformity.
  const cursor: number = prev?.offset ?? 0;

  let db: InstanceType<(typeof import('node:sqlite'))['DatabaseSync']> | undefined;
  try {
    // Open in read-only mode — must not create -wal or -shm files.
    db = new DatabaseSync(dbPath, { readOnly: true });

    const sql = `
      SELECT
        m.id, m.session_id, m.time_created, m.time_updated, m.data,
        s.parent_id
      FROM message m
      LEFT JOIN session s ON s.id = m.session_id
      WHERE m.time_updated > ?
      ORDER BY m.time_updated ASC
    `;

    const rows = db.prepare(sql).all(cursor) as unknown as MessageRow[];

    const events: UsageEvent[] = [];
    let newCursor = cursor;

    for (const row of rows) {
      if (row.time_updated > newCursor) newCursor = row.time_updated;
      const event = parseMessageRow(row);
      if (event) events.push(event);
    }

    return { events, newCursor, mtimeMs: st.mtimeMs };
  } catch {
    // Live WAL db can be locked or unavailable — return empty rather than throw.
    return { events: [], newCursor: cursor, mtimeMs: st.mtimeMs };
  } finally {
    try {
      db?.close();
    } catch {
      // Ignore close errors.
    }
  }
}

// ---------------------------------------------------------------------------
// Legacy JSON tree scan
// ---------------------------------------------------------------------------

/**
 * Scan the legacy storage/message/{sessionID}/msg_*.json tree.
 *
 * Each msg_*.json file is a single JSON object (not JSONL). The session
 * folder name is the session id; subagent detection uses `parentID` in the
 * message JSON when present, else falls back to the session index file
 * (not yet read here — best-effort for M2 legacy support).
 *
 * Incremental: tracks per-file mtime+offset (offset = 1 once the file has
 * been fully read, since single-JSON files don't grow).
 */
async function scanLegacyTree(
  storageDir: string,
  checkpoint: AdapterCheckpoint,
): Promise<{ events: UsageEvent[]; updatedCheckpoint: AdapterCheckpoint }> {
  const msgRoot = path.join(storageDir, 'message');
  const sessionDirs = await readdirSafe(msgRoot);

  const events: UsageEvent[] = [];
  const files: Record<string, { offset: number; mtimeMs: number }> = { ...checkpoint.files };

  for (const sessionId of sessionDirs) {
    const sessionDir = path.join(msgRoot, sessionId);
    const dirStat = await statOrNull(sessionDir);
    if (!dirStat?.isDirectory()) continue;

    const msgFiles = (await readdirSafe(sessionDir)).filter((f) => f.endsWith('.json'));

    for (const msgFile of msgFiles) {
      const filePath = path.join(sessionDir, msgFile);
      const st = await statOrNull(filePath);
      if (!st) continue;

      const prev = files[filePath];
      // offset=1 means this single-JSON file was already fully processed.
      if (prev && prev.mtimeMs === st.mtimeMs && prev.offset >= 1) continue;

      let raw: unknown;
      try {
        const content = await fs.readFile(filePath, 'utf8');
        raw = safeJsonParse(content);
      } catch {
        // Unreadable file — skip.
        continue;
      }

      if (raw === null || typeof raw !== 'object') {
        files[filePath] = { offset: 1, mtimeMs: st.mtimeMs };
        continue;
      }

      // Subagent detection: parentID in the message JSON when present.
      const msgObj = raw as Record<string, unknown>;
      const isSubagent = typeof msgObj['parentID'] === 'string' && msgObj['parentID'] !== '';

      const event = parseLegacyMessageFile(raw, sessionId, isSubagent);
      if (event) events.push(event);
      // Mark as fully processed (offset=1 = "done" for single-JSON files).
      files[filePath] = { offset: 1, mtimeMs: st.mtimeMs };
    }
  }

  return { events, updatedCheckpoint: { files } };
}

// ---------------------------------------------------------------------------
// detect() helper
// ---------------------------------------------------------------------------

/**
 * Classify one data root as installed/not-installed and collect any warnings.
 * Returns detected paths (the root itself when sources are found).
 */
async function detectRoot(root: string): Promise<{ paths: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const rootStat = await statOrNull(root);

  if (!rootStat) return { paths: [], warnings };

  if (!rootStat.isDirectory()) {
    warnings.push(`Expected a directory at ${root} but found a file.`);
    return { paths: [], warnings };
  }

  const dbPath = path.join(root, 'opencode.db');
  const legacyPath = path.join(root, 'storage', 'message');

  const hasDb = await fileExists(dbPath);
  const hasLegacy = (await statOrNull(legacyPath))?.isDirectory() ?? false;

  if (!hasDb && !hasLegacy) {
    warnings.push(
      `OpenCode data dir exists at ${root} but neither opencode.db nor storage/message/ was found. ` +
        'Persistence may be disabled or the data dir is from an unsupported version.',
    );
    return { paths: [], warnings };
  }

  if (hasDb) {
    // Warn when node:sqlite is not available — install will warn but not fail.
    const DatabaseSync = await getDatabaseSync();
    if (!DatabaseSync) {
      warnings.push(
        `opencode.db found at ${root} but node:sqlite is unavailable on this Node version ` +
          '(requires Node >= 22.5). Token events cannot be read from the SQLite database. ' +
          'Upgrade Node to enable OpenCode tracking.',
      );
    }
  }

  return { paths: [root], warnings };
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export const openCodeAdapter: ProviderAdapter & { defaultPlan: 'api' } = {
  id: ADAPTER_ID,
  displayName: 'OpenCode',
  // OpenCode has no inherent rate limits or session windows → static/api policy.
  defaultPlan: 'api',

  async detect(): Promise<AdapterDetection> {
    const roots = resolveDataRoots();
    const allPaths: string[] = [];
    const allWarnings: string[] = [];
    let installed = false;

    for (const root of roots) {
      const { paths, warnings } = await detectRoot(root);
      allPaths.push(...paths);
      allWarnings.push(...warnings);
      if (paths.length > 0) installed = true;
    }

    return { installed, paths: allPaths, warnings: allWarnings };
  },

  async scan(paths: string[], checkpoint?: AdapterCheckpoint): Promise<ScanResult> {
    const baseCheckpoint: AdapterCheckpoint = checkpoint ?? { files: {} };
    const allEvents: UsageEvent[] = [];
    const mergedFiles: Record<string, { offset: number; mtimeMs: number }> = {
      ...baseCheckpoint.files,
    };

    const DatabaseSync = await getDatabaseSync();

    for (const root of paths) {
      // --- SQLite path ---
      const dbPath = path.join(root, 'opencode.db');
      if (DatabaseSync && (await fileExists(dbPath))) {
        const { events, newCursor, mtimeMs } = await scanSqliteDb(
          dbPath,
          baseCheckpoint,
          DatabaseSync,
        );
        allEvents.push(...events);
        // Store the time_updated cursor in `offset`; mtimeMs is recorded but
        // NOT used to skip scans — WAL writes do not update the main file mtime.
        mergedFiles[dbPath] = { offset: newCursor, mtimeMs };
      }

      // --- Legacy JSON tree path ---
      const storageDir = path.join(root, 'storage');
      const legacyMsgDir = path.join(storageDir, 'message');
      if ((await statOrNull(legacyMsgDir))?.isDirectory()) {
        const legacyCheckpoint: AdapterCheckpoint = {
          files: Object.fromEntries(
            Object.entries(mergedFiles).filter(([k]) => k.startsWith(legacyMsgDir)),
          ),
        };
        const { events, updatedCheckpoint } = await scanLegacyTree(storageDir, legacyCheckpoint);
        allEvents.push(...events);
        for (const [k, v] of Object.entries(updatedCheckpoint.files)) {
          mergedFiles[k] = v;
        }
      }
    }

    return { events: allEvents, checkpoint: { files: mergedFiles } };
  },
};
