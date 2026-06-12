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
import type { AdapterCheckpoint, AdapterDetection, ProviderAdapter, ScanResult } from './index';

const ADAPTER_ID = 'claude-code';

/**
 * Resolve the base Claude config dir.
 * Precedence: CLAUDE_CONFIG_DIR env var → ~/.claude (Unix) / %USERPROFILE%\.claude (Windows).
 */
function resolveConfigDir(): string {
  const envOverride = process.env['CLAUDE_CONFIG_DIR'];
  if (envOverride) return envOverride;
  return path.join(os.homedir(), '.claude');
}

/** Extract the session UUID from a JSONL filename (strips leading 'agent-' prefix). */
function sessionUuidFromFilename(filename: string): string {
  if (filename.startsWith('agent-')) {
    return filename.slice('agent-'.length).replace(/\.jsonl$/, '');
  }
  return filename.replace(/\.jsonl$/, '');
}

/** Check whether a filename denotes a subagent session. */
function isSubagentFile(filename: string): boolean {
  return filename.startsWith('agent-');
}

/**
 * Cheaply extract file-extension hints from tool_use input paths.
 * Looks for string values in `input` that look like file paths with known extensions.
 */
function extractLangHints(toolUseContent: unknown[]): string[] | undefined {
  const extensions = new Set<string>();
  const fileExtRe = /\.([a-zA-Z0-9]+)$/;

  for (const block of toolUseContent) {
    if (
      block !== null &&
      typeof block === 'object' &&
      (block as Record<string, unknown>)['type'] === 'tool_use'
    ) {
      const input = (block as Record<string, unknown>)['input'];
      if (input !== null && typeof input === 'object') {
        for (const val of Object.values(input as Record<string, unknown>)) {
          if (typeof val === 'string') {
            const m = fileExtRe.exec(val);
            if (m?.[1]) extensions.add('.' + m[1].toLowerCase());
          }
        }
      }
    }
  }

  return extensions.size > 0 ? [...extensions] : undefined;
}

/** Shape of a raw record line in a Claude Code JSONL session file. */
interface RawRecord {
  type?: string;
  timestamp?: string;
  cwd?: string;
  sessionId?: string;
  message?: {
    role?: string;
    model?: string;
    content?: unknown;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

/**
 * Read new bytes from a JSONL file starting at `offset`, parse complete lines,
 * and return UsageEvent records along with the updated file offset.
 *
 * Partial trailing lines (incomplete writes) are silently skipped.
 */
async function readNewLines(
  filePath: string,
  offset: number,
  sessionKey: string,
  isSubagent: boolean,
): Promise<{ events: UsageEvent[]; newOffset: number }> {
  let fh: fs.FileHandle | undefined;
  try {
    fh = await fs.open(filePath, 'r');
    const stat = await fh.stat();
    const fileSize = stat.size;

    if (fileSize <= offset) {
      return { events: [], newOffset: offset };
    }

    const bytesToRead = fileSize - offset;
    const buf = Buffer.allocUnsafe(bytesToRead);
    const { bytesRead } = await fh.read(buf, 0, bytesToRead, offset);
    const chunk = buf.subarray(0, bytesRead).toString('utf8');

    // Split on newlines; the last element may be a partial line (no trailing \n).
    const lines = chunk.split('\n');

    // If the chunk ends with \n the last element will be empty — that's fine.
    // If not, the last element is a partial line from an in-progress write — skip it.
    const lastLineIsPartial = !chunk.endsWith('\n');
    const completeLines = lastLineIsPartial ? lines.slice(0, -1) : lines;

    // Advance offset only over the bytes corresponding to complete lines.
    const completeBytes = lastLineIsPartial
      ? Buffer.byteLength(lines.slice(0, -1).join('\n') + (lines.length > 1 ? '\n' : ''), 'utf8')
      : bytesRead;

    const events: UsageEvent[] = [];

    for (const line of completeLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let record: RawRecord;
      try {
        record = JSON.parse(trimmed) as RawRecord;
      } catch {
        // Malformed JSON line — skip silently (tolerant parsing).
        continue;
      }

      // We only care about assistant records with usage data.
      if (record.type !== 'assistant' && record.message?.role !== 'assistant') continue;
      const msg = record.message;
      if (!msg?.usage || !msg.model) continue;

      const usage = msg.usage;
      const inputTokens = usage.input_tokens ?? 0;
      const outputTokens = usage.output_tokens ?? 0;
      const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
      const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;

      // Parse timestamp; fall back to 0 if malformed (shouldn't happen in practice).
      const ts = record.timestamp ? new Date(record.timestamp).getTime() : 0;

      // Cheap lang hints from any tool_use blocks in the content array.
      let langHints: string[] | undefined;
      if (Array.isArray(msg.content)) {
        langHints = extractLangHints(msg.content as unknown[]);
      }

      const event: UsageEvent = {
        ts,
        adapter: ADAPTER_ID,
        modelId: msg.model,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        sessionKey,
        isSubagent,
        ...(record.cwd !== undefined ? { cwd: record.cwd } : {}),
        ...(langHints !== undefined ? { langHints } : {}),
      };

      events.push(event);
    }

    return { events, newOffset: offset + completeBytes };
  } finally {
    await fh?.close();
  }
}

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

export const claudeCodeAdapter: ProviderAdapter = {
  id: ADAPTER_ID,
  displayName: 'Claude Code',

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

    return {
      installed: true,
      paths: [projectsDir],
      warnings,
    };
  },

  async scan(paths: string[], checkpoint?: AdapterCheckpoint): Promise<ScanResult> {
    const fileCheckpoints: Record<string, { offset: number; mtimeMs: number }> = checkpoint
      ? { ...checkpoint.files }
      : {};

    const allEvents: UsageEvent[] = [];

    for (const rootPath of paths) {
      // rootPath is expected to be the projects/ directory.
      const projectDirs = await listProjectDirs(rootPath);

      for (const projectDir of projectDirs) {
        const jsonlFiles = await listJsonlFiles(projectDir);

        for (const filename of jsonlFiles) {
          const filePath = path.join(projectDir, filename);

          // Check current mtime.
          const st = await statOrNull(filePath);
          if (!st) continue; // File disappeared between readdir and stat — skip.

          const currentMtime = st.mtimeMs;
          const prev = fileCheckpoints[filePath];

          // If mtime is unchanged and we have a checkpoint, skip entirely.
          if (prev && prev.mtimeMs === currentMtime && prev.offset > 0) {
            continue;
          }

          const startOffset = prev?.offset ?? 0;
          const sessionKey = sessionUuidFromFilename(filename);
          const isSubagent = isSubagentFile(filename);

          const { events, newOffset } = await readNewLines(
            filePath,
            startOffset,
            sessionKey,
            isSubagent,
          );

          allEvents.push(...events);

          // Update checkpoint for this file.
          fileCheckpoints[filePath] = {
            offset: newOffset,
            mtimeMs: currentMtime,
          };
        }
      }
    }

    return {
      events: allEvents,
      checkpoint: { files: fileCheckpoints },
    };
  },
};
