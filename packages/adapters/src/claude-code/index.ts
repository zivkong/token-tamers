/**
 * Claude Code provider adapter.
 *
 * Reads {config-root}/projects/{encoded-path}/*.jsonl (read-only, incremental).
 * Never writes, never calls any API, never touches the network.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { UsageEvent } from '@token-tamers/core';
import type { AdapterCheckpoint, AdapterDetection, ProviderAdapter, ScanResult } from '../index';
import { readNewJsonlLines, safeJsonParse } from '../helpers/jsonl';
import {
  ADAPTER_ID,
  isSubagentFile,
  messageIdOf,
  parseRecord,
  sessionUuidFromFilename,
} from './parse';

// ---------------------------------------------------------------------------
// Config dir resolution
// ---------------------------------------------------------------------------

/**
 * Resolve candidate Claude config roots. Claude Code's data dir varies by
 * version and platform, and after a version migration sessions can be SPLIT
 * across roots — so every existing root is scanned, not just the first hit.
 * Precedence: CLAUDE_CONFIG_DIR (comma-separated, multi-root) →
 * $XDG_CONFIG_HOME/claude (newer builds; ~/.config/claude default) +
 * ~/.claude (legacy default; %USERPROFILE%\.claude on Windows).
 */
function resolveConfigRoots(): string[] {
  const env = process.env['CLAUDE_CONFIG_DIR'];
  if (env && env.trim().length > 0) {
    return env
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  const xdgBase = process.env['XDG_CONFIG_HOME'] ?? path.join(os.homedir(), '.config');
  return [path.join(xdgBase, 'claude'), path.join(os.homedir(), '.claude')];
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

/** Stat a path; return null if it does not exist. */
async function statOrNull(p: string): Promise<{ mtimeMs: number; isDirectory(): boolean } | null> {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

/** List all *.jsonl files under a project directory (non-recursive, flat). */
async function listJsonlFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith('.jsonl')).map((e) => e.name);
  } catch {
    return [];
  }
}

/** List all project subdirectories under the projects/ folder. */
async function listProjectDirs(projectsRoot: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => path.join(projectsRoot, e.name));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Per-file scan
// ---------------------------------------------------------------------------

interface ScanFileInput {
  filePath: string;
  startOffset: number;
  sessionKey: string;
  isSubagent: boolean;
  /** Message id of the last usage record emitted by a previous scan of this file. */
  lastMessageId?: string;
}

/**
 * Parse all new events from a JSONL session file starting at `startOffset`.
 *
 * Dedup: Claude Code logs one record per content block of an assistant
 * message; the whole group shares a message id and repeats IDENTICAL usage
 * totals (verified June 2026: 8.7k duplicate groups, zero with differing
 * usage — counting per record inflates tokens ~2.7x). Only the first record
 * of each id is emitted; `lastMessageId` extends the dedup across scan
 * boundaries, since a group can straddle two incremental reads.
 */
async function scanFile(
  input: ScanFileInput,
): Promise<{ events: UsageEvent[]; newOffset: number; lastMessageId?: string }> {
  const { lines, newOffset } = await readNewJsonlLines(input.filePath, input.startOffset);
  const events: UsageEvent[] = [];
  const seenIds = new Set<string>();
  if (input.lastMessageId !== undefined) seenIds.add(input.lastMessageId);
  let lastMessageId = input.lastMessageId;

  for (const line of lines) {
    const raw = safeJsonParse(line);
    const event = parseRecord(raw, input.sessionKey, input.isSubagent);
    if (!event) continue;
    const id = messageIdOf(raw);
    if (id !== undefined) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      lastMessageId = id;
    }
    events.push(event);
  }
  return { events, newOffset, ...(lastMessageId !== undefined ? { lastMessageId } : {}) };
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export const claudeCodeAdapter: ProviderAdapter & { defaultPlan: 'subscription' } = {
  id: ADAPTER_ID,
  displayName: 'Claude Code',
  // Claude Code subscriptions use a 5-hour session window → dynamic cycle policy.
  defaultPlan: 'subscription',

  async detect(): Promise<AdapterDetection> {
    const warnings: string[] = [];
    const paths: string[] = [];

    for (const configDir of resolveConfigRoots()) {
      const projectsDir = path.join(configDir, 'projects');
      const projectsStat = await statOrNull(projectsDir);
      if (!projectsStat) continue;

      if (!projectsStat.isDirectory()) {
        warnings.push(`Expected a directory at ${projectsDir} but found a file.`);
        continue;
      }

      // Claude Code auto-deletes sessions older than ~30 days; warn if the
      // projects folder appears completely empty (fresh install / all purged).
      const projectDirs = await listProjectDirs(projectsDir);
      if (projectDirs.length === 0) {
        warnings.push(
          `No project directories found under ${projectsDir}. ` +
            'This may be a fresh install or all sessions may have been purged (sessions older than ~30 days are auto-deleted).',
        );
      }

      paths.push(projectsDir);
    }

    return { installed: paths.length > 0, paths, warnings };
  },

  async scan(paths: string[], checkpoint?: AdapterCheckpoint): Promise<ScanResult> {
    const prevFiles = checkpoint?.files ?? {};
    // Rebuilt from the files seen THIS scan: entries for sessions Claude Code
    // has since deleted (~30-day retention) drop out, keeping the checkpoint
    // map bounded instead of growing for the lifetime of the install.
    const fileCheckpoints: AdapterCheckpoint['files'] = {};

    const allEvents: UsageEvent[] = [];

    for (const rootPath of paths) {
      const projectDirs = await listProjectDirs(rootPath);
      for (const projectDir of projectDirs) {
        const jsonlFiles = await listJsonlFiles(projectDir);
        for (const filename of jsonlFiles) {
          const filePath = path.join(projectDir, filename);
          const st = await statOrNull(filePath);
          if (!st) continue; // File disappeared between readdir and stat — skip.

          const prev = prevFiles[filePath];
          if (prev && prev.mtimeMs === st.mtimeMs && prev.offset > 0) {
            fileCheckpoints[filePath] = prev;
            continue;
          }

          const { events, newOffset, lastMessageId } = await scanFile({
            filePath,
            startOffset: prev?.offset ?? 0,
            sessionKey: sessionUuidFromFilename(filename),
            isSubagent: isSubagentFile(filename),
            ...(prev?.lastMessageId !== undefined ? { lastMessageId: prev.lastMessageId } : {}),
          });
          allEvents.push(...events);
          fileCheckpoints[filePath] = {
            offset: newOffset,
            mtimeMs: st.mtimeMs,
            ...(lastMessageId !== undefined ? { lastMessageId } : {}),
          };
        }
      }
    }

    return { events: allEvents, checkpoint: { files: fileCheckpoints } };
  },
};
