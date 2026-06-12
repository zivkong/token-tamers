/**
 * Incremental JSONL file-reading helpers.
 *
 * Reusable across adapters (Claude Code, Codex, OpenCode, …).
 * Read-only, always: these helpers never write to the filesystem.
 */

import * as fs from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of reading new bytes from a JSONL file starting at a byte offset. */
export interface ReadChunkResult {
  /** Byte offset to store in the checkpoint (points past the last complete line). */
  newOffset: number;
  /** Complete, non-empty, trimmed lines ready for JSON.parse. */
  lines: string[];
}

// ---------------------------------------------------------------------------
// Byte-offset read
// ---------------------------------------------------------------------------

/**
 * Open `filePath` for reading, seek to `offset`, and return all bytes to EOF.
 * Returns `null` when the file is at or below `offset` (nothing new).
 *
 * The caller is responsible for interpreting partial trailing lines.
 */
export async function readBytesFrom(
  filePath: string,
  offset: number,
): Promise<{ chunk: string; bytesRead: number } | null> {
  let fh: fs.FileHandle | undefined;
  try {
    fh = await fs.open(filePath, 'r');
    const stat = await fh.stat();
    if (stat.size <= offset) return null;

    const bytesToRead = stat.size - offset;
    const buf = Buffer.allocUnsafe(bytesToRead);
    const { bytesRead } = await fh.read(buf, 0, bytesToRead, offset);
    return { chunk: buf.subarray(0, bytesRead).toString('utf8'), bytesRead };
  } finally {
    await fh?.close();
  }
}

// ---------------------------------------------------------------------------
// Line splitting with partial-trailing-line tolerance
// ---------------------------------------------------------------------------

/**
 * Split a raw chunk from a live JSONL file into complete lines.
 *
 * If the chunk does not end with `\n` the final element is an in-progress write
 * and is silently dropped. Returns the lines and the number of *bytes* they
 * occupy (so the caller can advance the offset correctly).
 */
export function splitCompleteLines(chunk: string, bytesRead: number): ReadChunkResult {
  const lines = chunk.split('\n');
  const lastLineIsPartial = !chunk.endsWith('\n');

  const completeLines = lastLineIsPartial ? lines.slice(0, -1) : lines;

  const completeBytes = lastLineIsPartial
    ? Buffer.byteLength(completeLines.join('\n') + (completeLines.length > 0 ? '\n' : ''), 'utf8')
    : bytesRead;

  const nonEmpty = completeLines.map((l) => l.trim()).filter((l) => l.length > 0);

  return { lines: nonEmpty, newOffset: completeBytes };
}

// ---------------------------------------------------------------------------
// Per-line safe JSON parse
// ---------------------------------------------------------------------------

/**
 * Attempt to JSON-parse `line`. Returns the parsed value on success, or
 * `undefined` on parse failure (malformed / partial line). Never throws.
 */
export function safeJsonParse(line: string): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Combined: read new complete lines from a JSONL file at a byte offset
// ---------------------------------------------------------------------------

/**
 * Read all complete new lines from `filePath` starting at `offset`.
 *
 * Returns the parsed-ready lines and the new byte offset to checkpoint.
 * Returns `{ lines: [], newOffset: offset }` when the file has not grown.
 */
export async function readNewJsonlLines(
  filePath: string,
  offset: number,
): Promise<ReadChunkResult> {
  const raw = await readBytesFrom(filePath, offset);
  if (!raw) return { lines: [], newOffset: offset };

  const { lines, newOffset } = splitCompleteLines(raw.chunk, raw.bytesRead);
  return { lines, newOffset: offset + newOffset };
}
