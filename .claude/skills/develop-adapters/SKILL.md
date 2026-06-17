---
name: develop-adapters
description: Provider-adapter development for Token Tamers — UsageEvent contract, per-provider data sources and quirks (Claude Code, Codex CLI, OpenCode), incremental ingestion, fixture testing. Use when working under packages/adapters.
---

# Develop provider adapters (packages/adapters)

Source of truth: this skill (per-provider research findings, verified June 2026)
and `docs/design/architecture.md` (adapter layer). Adapters are versioned plugins emitting one normalized
`UsageEvent` stream; the engine never knows which agent produced an event. Format
drift in any provider = adapter patch, never an engine change.

**Adapters are pure data sources.** `AdapterConfig` is `{ provider, paths }` only — no plan,
no cycle policy, no clock. Within one adapter, API-billed and subscription-billed usage coexist
in the same stream and are emitted together (invariant 3: no billing/model judgment — every
token is essence). The cycle clock is a single pet-global choice (`UserConfig.cycle`), never per
adapter; see `develop-game-engine`.

## Iron rules

- **Read-only, always.** Open provider files for reading only; never write inside a
  provider's data dir; never call any API; never spend tokens/quota.
- **Incremental ingestion is mandatory.** Keep an `AdapterCheckpoint` (per-file
  offset + mtime) and read only new bytes. Providers prune their logs — the game's
  own store is the durable record.
- `detect()` must be cheap (stat data dirs) and surface warnings (missing dirs,
  persistence disabled) for `tt init` / `tt adapters`.
- Tolerate live files: skip malformed/partial trailing JSONL lines silently.
- Windows: resolve homes via `os.homedir()` (%USERPROFILE%).
- **No `process.env`.** Adapters never read environment variables. `detect(roots?)`
  takes optional override roots; the cli reads `~/.tokentamers/settings.json`
  (`adapterRoots[<id>]`) and passes them, falling back to each adapter's built-in
  default locations. `scan(paths)` always takes explicit paths (sourced from the
  config the user confirmed at `tt init`).

## Claude Code — SHIPPED (reference adapter, `src/claude-code/`)

- Source: `{config-root}/projects/{encoded-path}/*.jsonl`. Config roots vary by
  version and sessions can be SPLIT across roots after a migration — probe ALL
  roots. Override roots come from settings.json `adapterRoots["claude-code"]` (passed
  to `detect`); the built-in defaults are `~/.config/claude` (newer builds) + `~/.claude`
  (legacy). No env vars (XDG / `CLAUDE_CONFIG_DIR` are no longer consulted).
  Assistant records carry `message.usage` (input_tokens, output_tokens,
  cache_creation_input_tokens → cacheWriteTokens, cache_read_input_tokens →
  cacheReadTokens) and `message.model` (full model ID). Auxiliary local source
  (not yet ingested): `~/.claude/history.jsonl` (prompt index).
- **Real reset times via statusLine (the cli, NOT this adapter).** Claude Code ≥2.1.x
  pipes `rate_limits.five_hour.resets_at` / `seven_day.resets_at` (unix sec) to the
  configured statusLine command on stdin — the ONLY surface carrying it; it is in NO
  JSONL/native file (the `rate_limits` strings seen in transcripts are conversation
  text, not a native field). The cli's `tt statusline` captures it to
  `~/.tokentamers/usage.json` and catch-up anchors the weekly cycle to it (see
  `develop-game-engine` → week anchor). Adapters stay log-only; this is a cli surface.
- **Dedup by `message.id` (verified June 2026).** One assistant message is logged
  as one record PER CONTENT BLOCK; every record in the group repeats the same
  `message.id` and IDENTICAL usage totals (measured: 57% of usage records are
  duplicates → ~2.7x token inflation if counted per record; 8.7k duplicate groups,
  zero with differing usage). Emit the first record per id; duplicates are almost
  always adjacent, so a `lastMessageId` per file in the checkpoint extends the
  dedup across incremental scan boundaries.
- `{uuid}.jsonl` = main session; `agent-{uuid}.jsonl` = subagents → tag
  `isSubagent: true`.
- Caveats: format unofficial and may change; **sessions auto-delete after ~30 days**
  (incremental ingest + own store is the defense; prune checkpoint entries for
  deleted files); plan rate-limit % is not in the JSONL — the cli captures the real
  reset times from the statusLine payload (above), else the engine infers windows.

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
- ChatGPT plans have 5-hour + weekly windows, the same shape as Claude subscriptions —
  informational only. The adapter still carries no policy; if the player picks the global
  subscription cycle with this provider as the anchor, its session rhythm drives the clock.

## OpenCode — SHIPPED (`src/opencode/{index,parse}.ts`) — verified June 2026, v1.17.4

**Primary source: SQLite** (migrated from JSON tree in ~v1.x).

- DB at `~/.local/share/opencode/opencode.db` (WAL mode; `-wal`/`-shm` siblings present),
  the built-in default root. Override via settings.json `adapterRoots["opencode"]` (passed
  to `detect`); no env vars (`OPENCODE_DATA_DIR` / `XDG_DATA_HOME` are no longer consulted).
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
- No inherent rate-limit windows. The adapter's optional `defaultPlan: 'api'` is just a HINT
  the `tt init` wizard uses to default the global cycle choice toward **static** — it sets no
  per-adapter policy (the cycle is pet-global).

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
