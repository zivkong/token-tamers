/**
 * Claude Code provider adapter.
 *
 * Reads ~/.claude/projects/{encoded-path}/*.jsonl (read-only, incremental).
 * Never writes, never calls any API, never touches the network.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { UsageEvent } from '@token-tamers/core';
import type { AdapterCheckpoint, AdapterDetection, ProviderAdapter, ScanResult } from '../index';
import { readNewJsonlLines, safeJsonParse } from '../helpers/jsonl';
import { ADAPTER_ID, isSubagentFile, parseRecord, sessionUuidFromFilename } from './parse';

// ---------------------------------------------------------------------------
// Config dir resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the base Claude config dir.
 * Precedence: CLAUDE_CONFIG_DIR env var → ~/.claude (Unix) / %USERPROFILE%\.claude (Windows).
 */
function resolveConfigDir(): string {
  return process.env['CLAUDE_CONFIG_DIR'] ?? path.join(os.homedir(), '.claude');
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

/** Parse all new events from a JSONL session file starting at `startOffset`. */
async function scanFile(
  filePath: string,
  startOffset: number,
  sessionKey: string,
  isSubagent: boolean,
): Promise<{ events: UsageEvent[]; newOffset: number }> {
  const { lines, newOffset } = await readNewJsonlLines(filePath, startOffset);
  const events: UsageEvent[] = [];
  for (const line of lines) {
    const raw = safeJsonParse(line);
    const event = parseRecord(raw, sessionKey, isSubagent);
    if (event) events.push(event);
  }
  return { events, newOffset };
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
    const configDir = resolveConfigDir();
    const projectsDir = path.join(configDir, 'projects');

    const projectsStat = await statOrNull(projectsDir);
    if (!projectsStat) {
      return { installed: false, paths: [], warnings };
    }

    if (!projectsStat.isDirectory()) {
      warnings.push(`Expected a directory at ${projectsDir} but found a file.`);
      return { installed: false, paths: [], warnings };
    }

    const projectDirs = await listProjectDirs(projectsDir);

    // Claude Code auto-deletes sessions older than ~30 days; warn if the projects
    // folder appears completely empty (e.g. new install with no usage yet).
    if (projectDirs.length === 0) {
      warnings.push(
        `No project directories found under ${projectsDir}. ` +
          'This may be a fresh install or all sessions may have been purged (sessions older than ~30 days are auto-deleted).',
      );
    }

    return { installed: true, paths: [projectsDir], warnings };
  },

  async scan(paths: string[], checkpoint?: AdapterCheckpoint): Promise<ScanResult> {
    const fileCheckpoints: Record<string, { offset: number; mtimeMs: number }> = checkpoint
      ? { ...checkpoint.files }
      : {};

    const allEvents: UsageEvent[] = [];

    for (const rootPath of paths) {
      const projectDirs = await listProjectDirs(rootPath);
      for (const projectDir of projectDirs) {
        const jsonlFiles = await listJsonlFiles(projectDir);
        for (const filename of jsonlFiles) {
          const filePath = path.join(projectDir, filename);
          const st = await statOrNull(filePath);
          if (!st) continue; // File disappeared between readdir and stat — skip.

          const prev = fileCheckpoints[filePath];
          if (prev && prev.mtimeMs === st.mtimeMs && prev.offset > 0) continue;

          const startOffset = prev?.offset ?? 0;
          const sessionKey = sessionUuidFromFilename(filename);
          const isSubagent = isSubagentFile(filename);

          const { events, newOffset } = await scanFile(
            filePath,
            startOffset,
            sessionKey,
            isSubagent,
          );
          allEvents.push(...events);
          fileCheckpoints[filePath] = { offset: newOffset, mtimeMs: st.mtimeMs };
        }
      }
    }

    return { events: allEvents, checkpoint: { files: fileCheckpoints } };
  },
};
