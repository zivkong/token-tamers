/**
 * Claude Code JSONL record → UsageEvent mapping.
 *
 * Handles: usage fields, subagent tagging, langHints extraction.
 * Pure transformation — no I/O, no filesystem access.
 */

import type { UsageEvent } from '@token-tamers/core';

export const ADAPTER_ID = 'claude-code';

// ---------------------------------------------------------------------------
// Shape of a raw record line in a Claude Code JSONL session file
// ---------------------------------------------------------------------------

export interface RawRecord {
  type?: string;
  timestamp?: string;
  cwd?: string;
  sessionId?: string;
  message?: {
    id?: string;
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
 * Extract the API message id of a usage-bearing record, or undefined.
 * Claude Code writes one JSONL record per content block of an assistant
 * message; every record in the group repeats the SAME message id and the
 * SAME usage totals, so tokens must be counted once per id, not per record.
 */
export function messageIdOf(raw: unknown): string | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const id = (raw as RawRecord).message?.id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

// ---------------------------------------------------------------------------
// Filename helpers
// ---------------------------------------------------------------------------

/** Extract the session UUID from a JSONL filename (strips leading 'agent-' prefix). */
export function sessionUuidFromFilename(filename: string): string {
  const base = filename.startsWith('agent-') ? filename.slice('agent-'.length) : filename;
  return base.replace(/\.jsonl$/, '');
}

/** Return true when the filename denotes a subagent session. */
export function isSubagentFile(filename: string): boolean {
  return filename.startsWith('agent-');
}

// ---------------------------------------------------------------------------
// Lang hints extraction
// ---------------------------------------------------------------------------

/** Return true when `block` is a tool_use object with a non-null `input` map. */
function isToolUseBlock(
  block: unknown,
): block is { type: 'tool_use'; input: Record<string, unknown> } {
  if (block === null || typeof block !== 'object') return false;
  const b = block as Record<string, unknown>;
  return b['type'] === 'tool_use' && b['input'] !== null && typeof b['input'] === 'object';
}

/** Extract file-extension strings from one tool_use input map. */
function extensionsFromInput(input: Record<string, unknown>): string[] {
  const fileExtRe = /\.([a-zA-Z0-9]+)$/;
  const exts: string[] = [];
  for (const val of Object.values(input)) {
    if (typeof val !== 'string') continue;
    const m = fileExtRe.exec(val);
    if (m?.[1]) exts.push('.' + m[1].toLowerCase());
  }
  return exts;
}

/**
 * Cheaply extract file-extension hints from an array of content blocks.
 * Returns undefined when no tool_use blocks with path-like string inputs are found.
 */
export function extractLangHints(content: unknown[]): string[] | undefined {
  const extensions = new Set<string>();
  for (const block of content) {
    if (!isToolUseBlock(block)) continue;
    for (const ext of extensionsFromInput(block.input)) {
      extensions.add(ext);
    }
  }
  return extensions.size > 0 ? [...extensions] : undefined;
}

// ---------------------------------------------------------------------------
// Record → UsageEvent
// ---------------------------------------------------------------------------

/**
 * Parse a raw JSONL record into a UsageEvent.
 *
 * Returns `undefined` for non-assistant records, records without usage data,
 * or records without a model field. Never throws.
 */
export function parseRecord(
  raw: unknown,
  sessionKey: string,
  isSubagent: boolean,
): UsageEvent | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const record = raw as RawRecord;

  if (record.type !== 'assistant' && record.message?.role !== 'assistant') return undefined;
  const msg = record.message;
  if (!msg?.usage || !msg.model) return undefined;

  const usage = msg.usage;
  const ts = record.timestamp ? new Date(record.timestamp).getTime() : 0;

  let langHints: string[] | undefined;
  if (Array.isArray(msg.content)) {
    langHints = extractLangHints(msg.content as unknown[]);
  }

  return {
    ts,
    adapter: ADAPTER_ID,
    modelId: msg.model,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    sessionKey,
    isSubagent,
    ...(record.cwd !== undefined ? { cwd: record.cwd } : {}),
    ...(langHints !== undefined ? { langHints } : {}),
  };
}
