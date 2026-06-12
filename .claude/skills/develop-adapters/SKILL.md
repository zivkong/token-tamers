---
name: develop-adapters
description: Provider-adapter development for Token Tamers — UsageEvent contract, per-provider data sources and quirks (Claude Code, Codex CLI, OpenCode), incremental ingestion, fixture testing. Use when working under packages/adapters.
---

# Develop provider adapters (packages/adapters)

Source of truth: this skill (per-provider research findings, verified June 2026)
and `docs/design/architecture.md` (adapter layer). Adapters are versioned plugins emitting one normalized
`UsageEvent` stream; the engine never knows which agent produced an event. Format
drift in any provider = adapter patch, never an engine change.

## Iron rules

- **Read-only, always.** Open provider files for reading only; never write inside a
  provider's data dir; never call any API; never spend tokens/quota.
- **Incremental ingestion is mandatory.** Keep an `AdapterCheckpoint` (per-file
  offset + mtime) and read only new bytes. Providers prune their logs — the game's
  own store is the durable record.
- `detect()` must be cheap (stat data dirs) and surface warnings (missing dirs,
  persistence disabled) for `tt init` / `tt adapters`.
- Tolerate live files: skip malformed/partial trailing JSONL lines silently.
- Windows: resolve homes via `os.homedir()` (%USERPROFILE%), honor env overrides.

## Claude Code — SHIPPED (reference adapter, `src/claude-code.ts`)

- Source: `~/.claude/projects/{encoded-path}/*.jsonl` (override: `CLAUDE_CONFIG_DIR`).
  Assistant records carry `message.usage` (input_tokens, output_tokens,
  cache_creation_input_tokens → cacheWriteTokens, cache_read_input_tokens →
  cacheReadTokens) and `message.model` (full model ID). Auxiliary local sources
  (not yet ingested): `~/.claude/history.jsonl` (prompt index) and statusline
  snapshots.
- `{uuid}.jsonl` = main session; `agent-{uuid}.jsonl` = subagents → tag
  `isSubagent: true`.
- Caveats: format unofficial and may change; **sessions auto-delete after ~30 days**
  (incremental ingest + own store is the defense); plan rate-limit % is NOT available
  locally — we infer windows ourselves.

## Codex CLI — M2 (architecture-ready)

- Source: `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl` (default `~/.codex/`)
  plus `archived_sessions/`; `sessions/` wins over archive on duplicates.
- Token data is **cumulative**: `event_msg` records with
  `payload.type === "token_count"` → subtract previous totals to recover per-turn
  deltas (input, cached input, output, reasoning, total). `turn_context` carries the
  model ID.
- Caveats: ≥3 JSONL format generations → format detection required; some early-Sept-2025
  builds lack model metadata (skip those); `history.jsonl` can be size-capped;
  local persistence can be disabled by user config (init must detect & warn).
- ChatGPT plans have 5-hour + weekly windows → dynamic cycle policy, same shape as
  Claude subscriptions.

## OpenCode — SHIPPED (`src/opencode/{index,parse}.ts`) — verified June 2026, v1.17.4

**Primary source: SQLite** (migrated from JSON tree in ~v1.x).

- DB at `~/.local/share/opencode/opencode.db` (WAL mode; `-wal`/`-shm` siblings present).
  Override: `OPENCODE_DATA_DIR` env var (comma-separated multi-roots).
  Also honors `$XDG_DATA_HOME/opencode`.
- Tables: `message(id, session_id, time_created, time_updated, data JSON)`,
  `session(id, project_id, parent_id, ...)`, `part`, `project`.
- `message.data` JSON shape (assistant): `{"role":"assistant","modelID":"deepseek-v4-pro",
"providerID":"deepseek","path":{"cwd":"/..."},"tokens":{"total":N,"input":N,"output":N,
"reasoning":N,"cache":{"write":N,"read":N}},"time":{"created":N,"completed":N},"finish":"..."}`.
  Streaming rows have all-zero tokens and **no `time.completed`** — exclude these; only
  emit records where `time.completed` is present.
- `session.parent_id` non-null ⇒ subagent session → `isSubagent: true`.
- `outputTokens = tokens.output + tokens.reasoning` (reasoning is billed output).
- **Checkpointing**: `AdapterCheckpoint.files[dbPath].offset` is repurposed as a
  `time_updated` cursor (integer epoch ms), NOT a byte offset. Query:
  `WHERE m.time_updated > cursor ORDER BY m.time_updated ASC`.
- **WAL caveat**: WAL writes do NOT touch the main db file's mtime — never skip
  scanning on equal mtime; always query using the cursor.
- **node:sqlite version gate**: `import('node:sqlite')` is loaded lazily (dynamic
  import inside try/catch). Must not crash on Node < 22.5 where the builtin is absent —
  returns empty events on import failure. Node 22.x prints one `ExperimentalWarning`
  to stderr; this is expected and tolerated.
- **Lock tolerance**: wrap the entire open+query in try/catch; return empty scan rather
  than throw if the live WAL db is locked.
- **Read-only enforcement**: open with `{ readOnly: true }` — must not create `-shm` or
  `-wal` files; if open fails, catch and return empty.
- No inherent rate limits → **static / api cycle policy** (`defaultPlan: 'api'`).

**Legacy fallback** (OpenCode < ~v1.x):

- Source: `storage/message/{sessionID}/msg_{messageID}.json` single-JSON files.
- Same assistant-only / time.completed filter; `parentID` field in the message JSON
  signals subagent; subdir name = sessionId.
- Incremental: per-file `{offset: 1, mtimeMs}` (offset=1 = "fully read" for
  single-JSON files that don't grow).

Known accepted edge: a completed message row updated again by background sync would
re-emit; in practice completed messages are immutable in the OpenCode store.

## Future adapters (same interface)

Gemini CLI, GitHub Copilot CLI, Amp, Goose, Cursor. Prior art: ccusage reads all
three current providers locally with a unified report model.

## Testing: fixtures

Anonymized realistic log samples under `__tests__/fixtures/<provider>/`. Every parser bug
fix adds a fixture. Required coverage: full extraction, incremental rescan after
append (no duplicates), subagent tagging, malformed-line tolerance, detect() against
a temp dir via the env override.
