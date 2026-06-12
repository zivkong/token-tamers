---
name: adapter-dev
description: How to write or fix a Token Tamers provider adapter (claude-code, codex, opencode) — UsageEvent contract, per-provider quirks, fixture testing. Use when working under packages/adapters.
---

# Adapter development

- Contract: implement `ProviderAdapter` (`packages/adapters/src/index.ts`) emitting
  normalized `UsageEvent`s (`packages/core/src/types.ts`). The engine is provider-blind;
  every quirk is the adapter's job.
- **Read-only, always.** Adapters open log files for reading; they never write inside a
  provider's data dir, never call any API.
- **Incremental ingestion is mandatory:** keep an `AdapterCheckpoint`
  (per-file offset + mtime); re-scans read only new bytes. Providers prune logs
  (Claude Code auto-deletes sessions ~30 days old) — the game's own store is the
  durable record.
- Per-provider quirks:
  - **claude-code:** `~/.claude/projects/{encoded-path}/*.jsonl`; assistant records
    carry `message.usage` + `message.model`; `agent-{uuid}.jsonl` = subagents (tag
    `isSubagent`); tolerate malformed/partial trailing lines (live files).
  - **codex (M2):** cumulative `token_count` payloads → compute deltas; ≥3 JSONL format
    generations → detect; `sessions/` wins over `archived_sessions/` on duplicates.
  - **opencode (M2):** per-message JSON tree walk; `OPENCODE_DATA_DIR` multi-root;
    project/global storage split; prune-tolerant.
- **Testing:** fixture-based — anonymized real log samples under
  `packages/adapters/test/fixtures/<provider>/`. Every parser bug fix adds a fixture.
- `detect()` must be cheap (stat data dirs) and must surface warnings (e.g. persistence
  disabled) for `tt init` / `tt adapters`.
