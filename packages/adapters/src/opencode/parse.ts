/**
 * OpenCode SQLite record → UsageEvent mapping.
 *
 * Handles the SQLite-backed storage format shipped in OpenCode >= ~1.x
 * (verified June 2026 against v1.17.4).
 *
 * Pure transformation — no I/O, no filesystem access. Never throws.
 */

import type { UsageEvent } from '@token-tamers/core';

export const ADAPTER_ID = 'opencode';

// ---------------------------------------------------------------------------
// Shape of the raw data JSON blob stored in message.data
// ---------------------------------------------------------------------------

/**
 * Partial shape of an OpenCode assistant message's `data` JSON field.
 * Streaming (incomplete) messages have tokens all 0 and no time.completed.
 * Only completed messages carry final counts.
 */
export interface OpenCodeMessageData {
  role?: string;
  /** Raw model id, e.g. 'deepseek-v4-pro', 'claude-sonnet-4-6', 'gpt-4o'. */
  modelID?: string;
  providerID?: string;
  path?: { cwd?: string };
  tokens?: {
    total?: number;
    input?: number;
    output?: number;
    /** Reasoning tokens are billed output — summed into outputTokens. */
    reasoning?: number;
    cache?: {
      write?: number;
      read?: number;
    };
  };
  time?: {
    created?: number;
    /** Only present on completed messages; absent on streaming/incomplete rows. */
    completed?: number;
  };
  finish?: string;
}

// ---------------------------------------------------------------------------
// Row shape returned by the SQLite JOIN query
// ---------------------------------------------------------------------------

/**
 * Shape of a row returned by the message+session JOIN query.
 * `parent_id` comes from the session table via the JOIN.
 */
export interface MessageRow {
  id: string;
  session_id: string;
  time_created: number;
  time_updated: number;
  data: string;
  parent_id: string | null;
}

// ---------------------------------------------------------------------------
// Legacy JSON tree shape (OpenCode < ~1.x)
// ---------------------------------------------------------------------------

/**
 * Shape of a legacy msg_*.json single-message file under
 * storage/message/{sessionID}/msg_{messageID}.json.
 */
export interface LegacyMessageFile {
  id?: string;
  sessionID?: string;
  /** Parent session id when this session is a subagent. */
  parentID?: string;
  role?: string;
  modelID?: string;
  providerID?: string;
  path?: { cwd?: string };
  tokens?: {
    total?: number;
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: {
      write?: number;
      read?: number;
    };
  };
  time?: {
    created?: number;
    completed?: number;
  };
}

// ---------------------------------------------------------------------------
// SQLite row → UsageEvent
// ---------------------------------------------------------------------------

/**
 * Parse an OpenCode SQLite message row into a UsageEvent.
 *
 * Emits ONLY:
 * - role === 'assistant' records
 * - records with time.completed set (streaming-incomplete rows are excluded)
 *
 * Returns `undefined` for non-assistant rows, incomplete rows, or rows with
 * malformed data JSON. Never throws.
 */
export function parseMessageRow(row: MessageRow): UsageEvent | undefined {
  let data: OpenCodeMessageData;
  try {
    data = JSON.parse(row.data) as OpenCodeMessageData;
  } catch {
    return undefined;
  }

  if (data.role !== 'assistant') return undefined;

  // Exclude streaming/incomplete messages — only completed messages have
  // time.completed; streaming rows carry all-zero token counts anyway.
  if (data.time?.completed === undefined || data.time.completed === null) return undefined;

  const modelId = data.modelID;
  if (!modelId) return undefined;

  const ts = data.time.completed ?? data.time?.created ?? row.time_created;
  const tokens = data.tokens ?? {};
  const cache = tokens.cache ?? {};

  return {
    ts,
    adapter: ADAPTER_ID,
    modelId,
    inputTokens: tokens.input ?? 0,
    // Reasoning tokens are billed as output — add them to outputTokens.
    outputTokens: (tokens.output ?? 0) + (tokens.reasoning ?? 0),
    cacheReadTokens: cache.read ?? 0,
    cacheWriteTokens: cache.write ?? 0,
    sessionKey: row.session_id,
    isSubagent: row.parent_id !== null,
    ...(data.path?.cwd !== undefined ? { cwd: data.path.cwd } : {}),
  };
}

// ---------------------------------------------------------------------------
// Legacy JSON file → UsageEvent
// ---------------------------------------------------------------------------

/**
 * Parse a legacy OpenCode msg_*.json file object into a UsageEvent.
 *
 * Same filtering rules as the SQLite path:
 * - role === 'assistant' only
 * - time.completed must be present
 *
 * `sessionId` and `parentId` are passed in from the directory context
 * (the caller resolves the session folder name and parent from the session
 * index file when available).
 *
 * Never throws.
 */
export function parseLegacyMessageFile(
  raw: unknown,
  sessionId: string,
  isSubagent: boolean,
): UsageEvent | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const msg = raw as LegacyMessageFile;

  if (msg.role !== 'assistant') return undefined;
  if (msg.time?.completed === undefined || msg.time.completed === null) return undefined;

  const modelId = msg.modelID;
  if (!modelId) return undefined;

  const tokens = msg.tokens ?? {};
  const cache = tokens.cache ?? {};
  const ts = msg.time.completed;

  return {
    ts,
    adapter: ADAPTER_ID,
    modelId,
    inputTokens: tokens.input ?? 0,
    // Reasoning tokens are billed as output — add them to outputTokens.
    outputTokens: (tokens.output ?? 0) + (tokens.reasoning ?? 0),
    cacheReadTokens: cache.read ?? 0,
    cacheWriteTokens: cache.write ?? 0,
    sessionKey: sessionId,
    isSubagent,
    ...(msg.path?.cwd !== undefined ? { cwd: msg.path.cwd } : {}),
  };
}
