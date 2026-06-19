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

### Step 2 — Choose the cycle (ONE pet-global question)

The pet has a single life, so there is **one** cycle clock, chosen once — never per
adapter. The wizard asks a single question:

- **Subscription with limit windows** (Claude Pro/Max, ChatGPT plans) →
  **subscription cycle**: 5-hour session windows are inferred from usage gaps in a chosen
  **anchor adapter** — the provider whose subscription reset rhythm drives the molt clock. When
  more than one adapter is enabled the wizard asks which one is the anchor; a single adapter is
  the implicit anchor. Other adapters still feed essence, but never open or move windows.
- **API / pay-as-you-go / no limits / fixed cadence** (API keys, OpenCode, mixed) →
  **static cycle**: fixed **5-hour session windows** tiled from a **7-day week** anchored to a
  chosen epoch (default: next Monday 00:00 local; configurable). Any adapter's usage opens a
  window.

The default offered follows the enabled adapters' hints (any subscription-style provider ⇒
subscription, else static). **Adapters carry no plan of their own** — within one adapter, API-
and subscription-billed usage coexist and are ingested together as essence (invariant 3 forbids
billing/model judgment). So Claude subscription + Claude API in Claude Code, or OpenCode running
DeepSeek-via-API alongside a GLM subscription, all feed the same pet undifferentiated.

### Step 3 — Write config

Write to `~/.tokentamers/config.json`. The cycle is pet-global; adapters are pure data sources:

```json
{
  "schemaVersion": 4,
  "cycle": {
    "policy": "subscription | static",
    "anchorAdapter": "claude-code",
    "weekAnchor": 0
  },
  "adapters": [{ "provider": "...", "paths": ["..."] }]
}
```

(`anchorAdapter` is present only for the subscription policy. Old `config.json` from before
schema v4 — where `plan`/`cyclePolicy`/`weekAnchor` lived on each adapter — migrates forward
automatically: the cli synthesizes `cycle` from the legacy adapters and slims each adapter.)

### Step 4 — Backfill scan

Scan existing logs to **establish the player's normalization baseline**. The backfill derives the
already-CLOSED 5-h windows from history (using the same cycle policy the engine runs) and folds
each window's essence into the per-adapter baseline — _without_ replaying their molts, so history
seeds normalization but never retroactively evolves the pet. Once a full week of windows is
observed the Calibration flag clears immediately.

Cold start: the egg hatches and starts living from `now` (it is **not** parked at the future week
anchor); the first week is a **Calibration Egg** — it plays normally from day one, but grades are
provisional until a baseline exists. The fresh init also persists any usage that falls in a window
still open at `now` to the **pending buffer** (see §5 / `pending.json`).

### Step 5 — Persistence warnings

Warn if a provider's local persistence is disabled (Codex `history` off, etc.).

### Re-run semantics

Re-running `tt init` adds/removes adapters and re-confirms the cycle **without touching pet
state**. When a valid `state.json` already exists, re-init only rewrites `config.json` (the
cycle + adapter set); it never re-hatches the egg, re-seeds the baseline, or backfills. The
**week anchor is preserved** from the existing config so an existing pet's rebirth schedule never
shifts. Existing adapters keep their checkpoints; a newly added adapter has no checkpoint yet, so
the next catch-up scans its full history.

---

## 5. Cycle Policies (design baseline §5)

_Abstraction over the lifecycle._

### Canonical cycle rule

- **Evolution cycle = the 5-hour session window.** Every closed session window containing usage
  fires a `MOLT_CHECKPOINT` — the ONLY moment a pet can change stage, roll a trait, mutate, or
  evolve. No evolution ever happens between or outside molts. A molt is the _opportunity_ to
  evolve, not a guarantee: each stage must accrue a **maturity** requirement (and clear any quality
  gate) before it advances, so the egg→Apex climb is paced across ~5 active days rather than one
  stage per molt. See `evolution-grades-lineage.md` → _Stage maturity & pacing_.
- **Weekly cycle = the rebirth cycle, nothing else.** The week boundary fires REBIRTH only:
  ascension, legacy scoring, Archive record write, inheritance roll, new egg. The pet's final
  form — including its pattern form — is whatever it already became at its **last molt of the
  week**; rebirth never evolves it.
- **Egg fast-hatch (the one exception to "5-hour windows only").** Waiting up to 5 hours just to
  see the egg hatch is poor first-contact UX, so each week's egg hatches on a **bonus hatch
  checkpoint fired ≈10 minutes after that week's first usage**, instead of at the first 5-h window
  close. This is the ONLY molt that does not align to a 5-h window, and it applies **only to the
  egg→sprite hatch** — every later molt still respects the 5-h window. Mechanically it is an
  ADDITIVE checkpoint layered on top of the normal window chain (one per week, since every
  generation begins as an egg at a rebirth): it acts only while the pet is still an egg and is
  otherwise a no-op, so the normal windows, the pending buffer, and replay determinism are
  untouched. The hatch checkpoint hatches + rolls like any molt but is deliberately excluded from
  diet and the normalization baseline (those come only from real 5-h windows). Determinism: the
  checkpoint time is a pure function of the event stream + week anchor, identical under any advance
  granularity; and an unhatched egg guarantees no molt has consumed the week's events yet, so a
  resumed (truncated) buffer still identifies the week's first usage correctly.

### Abstract event table

The engine consumes only two abstract events, derived **once** over the merged stream of all
adapters (one clock for the pet — never per adapter):

| Abstract event      | Subscription policy                                                                         | Static policy                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **MOLT_CHECKPOINT** | Inferred 5-h session-window close, from usage gaps in the **anchor adapter's** stream alone | Fixed 5-h windows from anchor; a window only "closes" as a molt if it contained usage |
| **REBIRTH**         | Every 7 days from the week anchor                                                           | Every 7 days from the week anchor                                                     |

Under the subscription policy only the **anchor adapter** opens/closes windows (its session
rhythm is the clock); every adapter's usage inside an open window still feeds the molt. Under the
static policy any adapter's usage can open a fixed tile. Either way, a single molt covers the
whole pet, and grade/trait/evolution rolls fire once per window off the combined signals.

### Week anchor: real reset, self-syncing, reconcile

The week anchor's PHASE (which instant the 7-day boundary lands on) is sourced, in preference order:

1. **The player's real subscription reset.** Claude Code ≥2.1.x hands `rate_limits.seven_day.resets_at`
   (unix seconds) to the configured statusLine command on stdin — the ONLY surface that carries it
   (verified against the statusline/hooks docs; it is persisted to no Claude file). `tt statusline`
   captures it to `~/.tokentamers/usage.json`; catch-up then anchors the weekly cycle to it each run
   (in-memory — `config.json` is never rewritten). Opt-in, read-only, zero-network. No statusline
   configured ⇒ this layer is simply absent and the next one applies.
2. **The configured anchor** (`UserConfig.cycle.weekAnchor`, default next Monday 00:00 local at `tt init`).

Whatever the source, the anchor is never allowed to sit in the FUTURE: `effectiveWeekAnchor` (in
`cycle/`) keeps its phase but slides it back by whole weeks to the tile containing the pet's first
event. That whole-week shift leaves the weekly boundary phase — and the static 5-h window tiling, which
keeps the raw anchor — untouched. This is what makes the cycle self-syncing and stops a future anchor (a
freshly-init'd "next Monday", or an unobserved reset) from suspending rebirth.

**Reconcile.** A save whose sim clock already slipped past a weekly boundary without rebirthing — e.g.
one created before this fix, when a future anchor had `weekRebirths` frozen — is repaired once on load by
`Engine.reconcile(now)`: it fires the single owed catch-up rebirth (archive the pet + a fresh egg for the
current week). Idempotent and deterministic, and kept OUT of the pure `advanceTo` path so replay==resume
still holds; `advanceTo` can never double-fire it (it requires `simulatedTo ≥ boundary`).

**Manual rebirth ("Reborn Now").** At **Apex** the Pet page surfaces a **"Reborn Now"** button (the
Grow vitals row, counting down to the automatic weekly rebirth) that lets the player force an early
rebirth instead of waiting out the week — `Engine.rebornNow(now)` runs the same archive + fresh-egg
flow as a weekly rebirth, at `now`. Like `reconcile` it is a **player action** (alongside
habitat/trinket equips): kept OUT of `advanceTo`, not derived from events/clock, and consumes **no
RNG** (rebirth is RNG-free), so other pets' molt streams stay byte-identical (invariant 5). It does
**NOT move the weekly clock** — the fixed weekly boundary still fires on schedule (it stays synced to
the player's real subscription reset), so the new egg simply gets the **remainder of the current
week** before the next auto-rebirth. A no-op on a pre-hatch egg. Idle purity is preserved: it is an
optional convenience, never required. Because a forced early rebirth is not reproducible from the
event stream, a full replay-from-scratch would not re-derive it — the same caveat as equips; the cli
always resumes from the persisted snapshot, never replays from zero. The grade guard (a non-S Apex
warns and requires a confirm press, since it can still grade up) lives in the TUI, not the engine.

### Real-world signal mapping table

Mapping of real-world signals (now per-policy):

| Real-world event                                                                     | Game meaning                               |
| ------------------------------------------------------------------------------------ | ------------------------------------------ |
| Token consumption (any provider)                                                     | Nutrition / essence                        |
| Model-ID mix                                                                         | Diet → House/species (identity only)       |
| Session window close                                                                 | **Molt** — evolution checkpoint            |
| Week boundary                                                                        | **Rebirth** — pet ascends, new egg hatches |
| Riding a window to its cap (subscription) / near-continuous use of a window (static) | Trait trigger (Marathoner)                 |
| Hitting weekly limit exactly (subscription only)                                     | Rare "Limitbreaker" evolution              |
| Week of zero usage                                                                   | Pet goes **Dormant** (cocoon, not death)   |

### Multi-provider normalization rule

Multi-provider players: all adapters feed ONE pet on ONE clock. Essence is normalized per adapter
against that adapter's own baseline, then combined — so adding a second agent never inflates
power, only diversifies diet. The clock is global: the subscription policy's molt windows are
driven by the anchor adapter alone, while every adapter (anchor or not, API or subscription
billed) contributes normalized essence to whatever window is open.

### Weekly three-act arc

- **Growth** (days 1–3): molts and traits accrue; the maturity-paced climb advances the pet
  through its early stages (it does NOT finish the climb here — that is the point of pacing).
- **Bloom** (days 4–6): form matures; the final maturity-gated step (Prime → Apex, grade ≥ B)
  typically lands here for a sustained week, and one random molt fires the weekly **Bloom event** —
  a guaranteed rare roll.
- **Twilight** (final ~24h): legacy score crystallizes; UI previews rebirth inheritance. (Form
  is already final after the week's last molt — Twilight and the rebirth boundary itself never
  evolve the pet.)

### Weekly weather

Deterministic seed from ISO week number biases trait rates ("Storm Week: Sprinter rolls
doubled"). Shared by everyone, no server.
