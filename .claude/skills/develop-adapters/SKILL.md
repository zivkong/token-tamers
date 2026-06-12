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

## OpenCode — M2 (architecture-ready)

- Source: `~/.local/share/opencode/storage/` —
  `message/{sessionID}/msg_{messageID}.json` (per-message token counts) +
  `session/{projectHash}/{sessionID}.json` index. Newer builds split
  `project/<slug>/storage/` vs `global/storage/`. `OPENCODE_DATA_DIR` may override;
  support comma-separated multi-roots.
- Per-message token counts present; stored `cost: 0` is meaningless — we only need
  tokens. Parent/child subagent sessions exist — aggregate like Claude/Codex.
- Caveats: multi-provider by design → model IDs are arbitrary strings incl. local
  models (the models.json registry handles this); storage grows unboundedly and
  users prune → prune-tolerant ingestion; no inherent limits → **static cycle policy**.

## Future adapters (same interface)

Gemini CLI, GitHub Copilot CLI, Amp, Goose, Cursor. Prior art: ccusage reads all
three current providers locally with a unified report model.

## Testing: fixtures

Anonymized realistic log samples under `__tests__/fixtures/<provider>/`. Every parser bug
fix adds a fixture. Required coverage: full extraction, incremental rescan after
append (no duplicates), subagent tagging, malformed-line tolerance, detect() against
a temp dir via the env override.
