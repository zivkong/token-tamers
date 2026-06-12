# Token Tamers — Lifecycle and Cycle Policies

Derived from the v1.0.3 design baseline. Covers §4 (Setup: `tt init`) and §5 (Cycle Policies).

---

## 4. Setup: `tt init` (design baseline §4)

One-time interactive wizard (the ONLY required interaction, ever):

### Step 1 — Detect installed agents

Probe data directories:

- `~/.claude/projects/`
- `$CODEX_HOME/sessions/`
- `~/.local/share/opencode/storage/` (plus env overrides)

Multi-select confirm of detected providers.

### Step 2 — Per provider: ask plan type

- **Subscription with limit windows** (Claude Pro/Max, ChatGPT plans) →
  **dynamic cycle policy**
- **API / pay-as-you-go / no limits** (API keys, OpenCode any provider) →
  **static cycle policy**: the wizard converts the canonical rhythm into fixed windows at init —
  default **5-hour session windows** and a **7-day week** anchored to a chosen epoch (default:
  next Monday 00:00 local; configurable).

### Step 3 — Write config

Write to `~/.tokentamers/config.json`:

```json
{
  "adapters": [
    {
      "provider": "...",
      "paths": "...",
      "plan": "...",
      "cycle_policy": "...",
      "week_anchor": "..."
    }
  ],
  "…": "…"
}
```

### Step 4 — Backfill scan

Scan existing logs to establish the player's normalization baseline. Cold start: the first week
hatches a **Calibration Egg** — it plays normally but grades are provisional until a baseline
exists.

### Step 5 — Persistence warnings

Warn if a provider's local persistence is disabled (Codex `history` off, etc.).

### Re-run semantics

Re-running `tt init` adds/removes adapters without touching pet state.

---

## 5. Cycle Policies (design baseline §5)

_Abstraction over the lifecycle._

### Canonical cycle rule

- **Evolution cycle = the 5-hour session window.** Every closed session window containing usage
  fires a MOLT_CHECKPOINT — the ONLY moment a pet can change stage, roll a trait, mutate, or
  evolve. No evolution ever happens between or outside molts.
- **Weekly cycle = the rebirth cycle, nothing else.** The week boundary fires REBIRTH only:
  ascension, legacy scoring, Archive record write, inheritance roll, new egg. The pet's final
  form — including its pattern form — is whatever it already became at its **last molt of the
  week**; rebirth never evolves it.

### Abstract event table

The engine consumes only two abstract events; policies produce them:

| Abstract event      | Dynamic policy (subscription)                                             | Static policy (API/OpenCode)                                                          |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **MOLT_CHECKPOINT** | Inferred 5-h session-window close (from usage gaps + plan reset schedule) | Fixed 5-h windows from anchor; a window only "closes" as a molt if it contained usage |
| **REBIRTH**         | Weekly limit reset                                                        | Every 7 days from week anchor                                                         |

### Real-world signal mapping table

Mapping of real-world signals (now per-policy):

| Real-world event                                                                | Game meaning                               |
| ------------------------------------------------------------------------------- | ------------------------------------------ |
| Token consumption (any provider)                                                | Nutrition / essence                        |
| Model-ID mix                                                                    | Diet → House/species (identity only)       |
| Session window close                                                            | **Molt** — evolution checkpoint            |
| Week boundary                                                                   | **Rebirth** — pet ascends, new egg hatches |
| Riding a window to its cap (dynamic) / near-continuous use of a window (static) | Trait trigger (Marathoner)                 |
| Hitting weekly limit exactly (dynamic only)                                     | Rare "Limitbreaker" evolution              |
| Week of zero usage                                                              | Pet goes **Dormant** (cocoon, not death)   |

### Multi-provider normalization rule

Multi-provider players: all adapters feed ONE pet. Essence is normalized per adapter against
that adapter's own baseline, then summed — so adding a second agent never inflates power, only
diversifies diet.

### Weekly three-act arc

- **Growth** (days 1–3): molts and traits accrue.
- **Bloom** (days 4–6): form matures; one random molt fires the weekly **Bloom event** — a
  guaranteed rare roll.
- **Twilight** (final ~24h): legacy score crystallizes; UI previews rebirth inheritance. (Form
  is already final after the week's last molt — Twilight and the rebirth boundary itself never
  evolve the pet.)

### Weekly weather

Deterministic seed from ISO week number biases trait rates ("Storm Week: Sprinter rolls
doubled"). Shared by everyone, no server.
