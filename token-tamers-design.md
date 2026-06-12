# Token Tamers — Product Design Document

**Version:** 1.0.3-MVP (Lint: ESLint + Prettier)
**Date:** June 12, 2026
**Status:** FINAL design baseline — implementation starts (GitHub + Claude Code)

**Version history (design phase):** 0.1 brainstorm consolidation · 0.2
provider-agnostic (3 adapters, init wizard, cycle policies, Houses) · 0.3
visual engine (half-block, palette indirection, beauty ladder) · 0.4 art
direction + CLAUDE.md/skills + wiki plan · 0.5 IP-clean · 0.6 canonical cycle
rule · 0.7 habitats & trinkets · 0.8 grade-roll system · 0.9 30fps slim default
· 0.10 evolution tree + retention plan · 0.11 fully-offline + completionist
core + achievements · 0.12 clickable 4:3 TUI shell · **1.0 finalized MVP**.

---

## 1. Concept

**Token Tamers** is a fully idle, terminal-based virtual pet game for developers.
An evolving monster companion is raised passively by the developer's real AI coding-agent
usage — no interaction required. The game observes **local usage data from the
developer's coding agent of choice** (Claude Code, Codex CLI, or OpenCode) and
converts actual work patterns into pet growth, evolution, battles, and breeding.

**One-liner:** *Your work raises a monster. Literally. Whatever agent you use.*
**Player goal:** complete the collection — every Dex entry, achievement,
habitat, and trinket. A fully offline completionist journey.

### Critical platform constraint (applies to ALL providers)
Token Tamers **never calls any AI API and never spends the user's tokens or quota**.
Provider policies generally prohibit using subscription credentials in third-party
tools. The game is therefore a **passive, read-only observer**: a local daemon reads each agent's local session logs and gamifies them.
The pet grows because the dev shipped real work, not because a script burned tokens.

---

## 2. Design Pillars

1. **Fully idle.** Zero required interaction. The game *is* your job. Viewing the pet
   is optional; progress never depends on it.
2. **No model judgment.** Model choice may only influence *species identity and
   cosmetics* — never stats, rarity, grades, or progression speed. All power metrics
   are normalized against the player's **own baseline per provider**, not absolute
   token volume. An all-light-model dev and an all-frontier-model dev with similar
   work patterns raise equally strong pets. (Write this promise into the README.)
3. **Horizontal evolution.** Every final form has an equal total stat budget,
   distributed differently. Different builds, not better builds.
4. **Version agnostic.** Hashes/DNA codes outlive game versions. Content is data, not
   code. Additive-only registries. Every hash ever shared stays valid forever.
5. **Provider agnostic.** No coding agent is privileged. Providers are adapter
   plugins emitting one normalized event stream; the game engine never knows or
   cares which agent produced an event. Cross-provider battles and DNA merges are
   first-class (a Codex dev can battle a Claude Code dev).
6. **Social by DNA.** Solo players get a complete game; the rarest third of the
   collection requires trading DNA with colleagues.
7. **Fully local, zero internet.** The game NEVER touches the network: no API
   calls, no telemetry, no update checks, no remote content, no sync. All
   social features work by humans exchanging text codes (paste over chat);
   all "shared world" features (weather, Drifter DNA) are derived
   deterministically from the calendar so every offline machine agrees.
   Content arrives only when the user installs an update themselves.
8. **Completionist North Star.** The goal of the game is **100% completion** —
   fill the Dex, earn every achievement, unlock every habitat and trinket.
   Grades are a texture of the journey (and gate some achievements), but the
   destination is the collection, not the grade.

---

## 3. Provider Support & Local Tracking (research findings, verified June 2026)

### 3.1 Claude Code — SUPPORTED (reference adapter)
- **Source:** `~/.claude/projects/{encoded-path}/*.jsonl` — one JSONL file per
  session; assistant records carry `message.usage` (input_tokens, output_tokens,
  cache_creation_input_tokens, cache_read_input_tokens) and `message.model` (full
  model ID, e.g. `claude-sonnet-4-5-20250929`). Also `~/.claude/history.jsonl`
  (prompt index) and statusline snapshots.
- **Session naming:** `{uuid}.jsonl` main session; `agent-{uuid}.jsonl` subagents
  (parse top-level only or tag subagent usage separately, like ccusage does).
- **Caveats:** format is unofficial/undocumented and may change; **sessions older
  than ~30 days are auto-deleted** → daemon must ingest incrementally and persist
  to its own store (already our architecture); plan rate-limit % is NOT available
  locally (only via API response headers) → we infer windows ourselves.

### 3.2 Codex CLI — SUPPORTED
- **Source:** `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl` (default
  `~/.codex/`), plus `archived_sessions/`. Also `~/.codex/history.jsonl`.
- **Token data:** `event_msg` records with `payload.type === "token_count"` report
  **cumulative** totals → adapter must subtract previous totals to recover per-turn
  deltas (input, cached input, output, reasoning, total). `turn_context` metadata
  carries the active model ID.
- **Caveats:** at least three JSONL format generations exist (≥0.44, mid, 2025/08)
  → adapter needs format detection; some early-Sept-2025 builds lack model metadata
  (skip those, like ccusage); `history.jsonl` can be size-capped/compacted; local
  persistence can be disabled by user config (init wizard must detect & warn).
- **Plan note:** ChatGPT plans also have 5-hour + weekly limit windows → dynamic
  cycle policy applies, same shape as Claude subscription.

### 3.3 OpenCode — SUPPORTED
- **Source:** `~/.local/share/opencode/storage/` —
  `message/{sessionID}/msg_{messageID}.json` (per-message JSON, token counts inside)
  and `session/{projectHash}/{sessionID}.json` index. Newer builds also use
  `project/<slug>/storage/` vs `global/storage/` split. `OPENCODE_DATA_DIR` may
  override; support comma-separated roots.
- **Token data:** per-message token counts present; `cost: 0` is stored (cost must
  be derived if ever needed — we don't need cost, only tokens). Subagent sessions
  exist (parent/child) — aggregate like Codex/Claude subagents.
- **Caveats:** multi-provider by design → model IDs are arbitrary strings across
  vendors incl. local models (perfect fit for our model-ID registry); storage grows
  unboundedly and users may prune — incremental ingestion again mandatory; no
  inherent session/weekly limits → **static cycle policy**.
- Prior art proving feasibility of all three: ccusage reads Claude Code, Codex, and
  OpenCode locally with a unified report model.

### 3.4 Future adapters (out of scope v1, architecture-ready)
Gemini CLI, GitHub Copilot CLI, Amp, Goose, Cursor — same adapter interface.

---

## 4. Setup: `tt init`

One-time interactive wizard (the ONLY required interaction, ever):

1. **Detect** installed agents by probing data dirs:
   `~/.claude/projects/`, `$CODEX_HOME/sessions/`,
   `~/.local/share/opencode/storage/` (+ env overrides). Multi-select confirm.
2. **Per provider, ask plan type:**
   - *Subscription with limit windows* (Claude Pro/Max, ChatGPT plans) →
     **dynamic cycle policy**
   - *API / pay-as-you-go / no limits* (API keys, OpenCode any provider) →
     **static cycle policy**: the wizard converts the canonical rhythm into fixed
     windows at init — default **5-hour session windows** and a **7-day week**
     anchored to a chosen epoch (default: next Monday 00:00 local; configurable).
3. **Write config** to `~/.tokentamers/config.json`:
   `{ adapters: [{provider, paths, plan, cycle_policy, week_anchor}], … }`
4. **Backfill scan** of existing logs to establish the player's normalization
   baseline. Cold start: the first week hatches a **Calibration Egg** — it plays
   normally but grades are provisional until a baseline exists.
5. Warn if a provider's local persistence is disabled (Codex `history` off, etc.).

Re-running `tt init` adds/removes adapters without touching pet state.

---

## 5. Cycle Policies (abstraction over §"Lifecycle")

**Canonical cycle rule:**
- **Evolution cycle = the 5-hour session window.** Every closed session window
  containing usage fires a MOLT_CHECKPOINT — the ONLY moment a pet can change
  stage, roll a trait, mutate, or evolve. No evolution ever happens between or
  outside molts.
- **Weekly cycle = the rebirth cycle, nothing else.** The week boundary fires
  REBIRTH only: ascension, legacy scoring, Archive record write, inheritance
  roll, new egg. The pet's final form — including its pattern form — is whatever
  it already became at its **last molt of the week**; rebirth never evolves it.

The engine consumes only two abstract events; policies produce them:

| Abstract event     | Dynamic policy (subscription)            | Static policy (API/OpenCode)            |
|--------------------|------------------------------------------|------------------------------------------|
| **MOLT_CHECKPOINT**| Inferred 5-h session-window close (from usage gaps + plan reset schedule) | Fixed 5-h windows from anchor; a window only "closes" as a molt if it contained usage |
| **REBIRTH**        | Weekly limit reset                       | Every 7 days from week anchor            |

Mapping of real-world signals (now per-policy):

| Real-world event                  | Game meaning                                 |
|-----------------------------------|----------------------------------------------|
| Token consumption (any provider)  | Nutrition / essence                          |
| Model-ID mix                      | Diet → House/species (identity only)         |
| Session window close              | **Molt** — evolution checkpoint              |
| Week boundary                     | **Rebirth** — pet ascends, new egg hatches   |
| Riding a window to its cap (dynamic) / near-continuous use of a window (static) | Trait trigger (Marathoner) |
| Hitting weekly limit exactly (dynamic only) | Rare "Limitbreaker" evolution      |
| Week of zero usage                | Pet goes **Dormant** (cocoon, not death)     |

Multi-provider players: all adapters feed ONE pet. Essence is normalized per
adapter against that adapter's own baseline, then summed — so adding a second
agent never inflates power, only diversifies diet.

### Weekly three-act arc
- **Growth** (days 1–3): molts and traits accrue.
- **Bloom** (days 4–6): form matures; one random molt fires the weekly **Bloom
  event** — a guaranteed rare roll.
- **Twilight** (final ~24h): legacy score crystallizes; UI previews rebirth
  inheritance. (Form is already final after the week's last molt — Twilight and
  the rebirth boundary itself never evolve the pet.)

### Weekly weather
Deterministic seed from ISO week number biases trait rates ("Storm Week: Sprinter
rolls doubled"). Shared by everyone, no server.

---

## 6. Evolution System (monster-taming style)

### Stage track
**Seed → Sprite → Rookie → Evolved → Prime → Apex**
- Molt 1–2 guaranteed progression; molt 3–5 behavioral branching; molt 6+ rares,
  patterns, rising mutation chance. Solo reaches Apex — standard pool only.

### Model-ID registry & Houses
Species identity now derives from **raw model IDs** via a data-driven registry —
no hardcoded Claude classes, works for any provider and any future model:

- `content/vN/models.json`: ordered pattern rules →
  `{ pattern: "claude-*", house: "aether", gene_id, tint }`, etc.
- **Houses (v1)** — identity & cosmetics only, equal stat budgets:
  - **Aether** — `claude-*` model-ID family
  - **Cipher** — `gpt-*` / `o*` model-ID family
  - **Flux** — `gemini-*` model-ID family
  - **Forge** — open-weight/local families (llama, qwen, mistral, deepseek, …)
  - **Wild** — unmatched model IDs → stored as a **dormant gene** ("???"), awakens
    when a registry update adds the pattern (version-agnostic by construction)
- Each distinct model ID consumed = a **gene** in the pet's diet profile. Dominant
  House → species line; cross-House diet → hybrid lines; high gene diversity feeds
  the Polyglot/Prism end of the trait system.
- Stat *distribution flavor* per line comes from content data (e.g., Aether-line
  leans WIS, Cipher-line leans PWR, Flux SPD, Forge GRT — tunable, and always an
  equal total budget). **No House is stronger; no model is "better food."**
- Old "Sage/Artisan/Swift by Opus/Sonnet/Haiku" framing is retired; those names may
  survive as *sub-line names within Aether* in content packs.

### Evolution axes
1. **Diet** (model-ID/House mix) → species line (cosmetic/identity).
2. **Appetite** (volume normalized to own per-adapter baseline) → tier gating.
3. **Rhythm** (session pattern) → variants: Burnout / Disciplined / Nocturne.

### Trait system (rolled once per molt; up to ~5 slots) — all model-neutral
| Trait       | Trigger                                                    |
|-------------|-------------------------------------------------------------|
| Marathoner  | Rode a session window to its cap / near-continuous window    |
| Sprinter    | Short intense bursts with long gaps                          |
| Polyglot    | 3+ languages/file types touched                              |
| Nightshade  | Majority usage after midnight                                |
| Daybreaker  | Pre-9am sessions                                             |
| Switcher    | Changed model IDs mid-session (rewards mixing, never punishes mono-model) |
| Deepdiver   | One long continuous conversation thread                      |
| Swarm       | Many parallel short sessions                                 |
| **Polyhost**| *NEW:* meaningful usage from 2+ provider adapters in one window |

Molt evaluation inputs: session count, gap rhythm, time-of-day spread, window-cap
proximity, tool diversity, streak vs burst, adapter diversity.

### Pattern evolutions (trait combos — checked at every molt, locked at the week's final molt)
- Marathoner + Nightshade → **Vigil**
- Sprinter + Swarm → **Tempest**
- Any 4 distinct traits → **Prism**
- *NEW:* Polyhost + Switcher → **Chimera** (the multi-agent flex form)

### Mutations
~5% per molt: palette shift, off-line trait, or stat swap.

---

## 7. Evolution Tree (v1 content)

Dex target: **112 entries** — 45 base species + 8 hybrid-line species + 35
pattern variants + 12 fusion-locked specials (hidden) + 12 reserved/Ancient slots.

### Stage 0 — universal egg
- **Mote** — every lineage hatches as a Mote; first molt commits it to a House
  by the window's dominant model-ID gene.

### House lines (Seed→Sprite→Rookie→Evolved→Prime→Apex)

**AETHER** (`claude-*` genes; WIS-lean; ethereal/mind theme)
- Sprite: **Wisp**
- Rookie: **Aetherling** · **Murmur**
- Evolved: **Oraclet** · **Cirrux** · **Nimbusk**
- Prime: **Seraphix** · **Thoughtwarden** · **Halcyore**
- Apex: **Aurelion** · **Mindspire**

**CIPHER** (`gpt-*`/`o*` genes; PWR-lean; glyph/geometry theme)
- Sprite: **Glyphit**
- Rookie: **Cipherling** · **Bitfang**
- Evolved: **Runeclaw** · **Vectorix** · **Glyphound**
- Prime: **Cryptarch** · **Matrixion** · **Sigilus**
- Apex: **Enigmax** · **Keystrix**

**FLUX** (`gemini-*` genes; SPD-lean; light/current theme)
- Sprite: **Sparkit**
- Rookie: **Fluxling** · **Voltby**
- Evolved: **Arcfin** · **Photonix** · **Surgewing**
- Prime: **Stormlynx** · **Luminaire** · **Ionyx**
- Apex: **Voltaicore** · **Radiantus**

**FORGE** (open-weight genes; GRT-lean; metal/ember theme)
- Sprite: **Emberit**
- Rookie: **Forgeling** · **Cindcub**
- Evolved: **Anvilisk** · **Slaghorn** · **Kilnox**
- Prime: **Smeltitan** · **Ironmaw** · **Basaltus**
- Apex: **Magmarok** · **Adamantor**

### Branch logic at each molt
- Rookie fork: rhythm so far (steady → first slot, bursty → second).
- Evolved fork (3-way): dominant trait class — endurance (Marathoner/Deepdiver),
  tempo (Sprinter/Swarm), or breadth (Polyglot/Switcher).
- Prime fork (3-way): consistency index band vs own baseline (low/mid/high —
  all three are *different*, none stronger; horizontal budgets).
- Apex fork (2-way): lifetime arc — early-peaking lineage vs late-bloomer.
- **Rhythm variants** (Burnout/Disciplined/Nocturne) are palette/pose variants
  applied from Evolved onward — not separate species, but distinct Dex entries'
  flair and battle intro lines.

### Hybrid lines (cross-House diet ≥35/35 split, or early-stage DNA graft)
- **Mistral line** (Aether×Flux): Rookie **Zephling** → Evolved **Galewisp** →
  Prime **Aeolyx** → Apex **Mistralis**
- **Obsidian line** (Forge×Cipher): Rookie **Shardling** → Evolved **Vitrix** →
  Prime **Obsidianth** → Apex **Tessellor**
- (Other House pairs reserved for future packs — additive-only IDs.)

### Pattern variants (overlay forms at Prime/Apex when pattern criteria lock)
Named variants of the base species, e.g. **Vigil Aurelion**, **Tempest
Voltaicore**, **Prism Sigilus**, **Chimera Mistralis** — unique palette, aura,
and one signature battle move per pattern. 4 patterns × applicable Prime/Apex
species ≈ 35 curated variants in v1 (not every combo ships; content packs add).

### Fusion-locked specials (12 in v1 — INTERNAL ONLY, wiki hints only)
One pool per DNA type; pools published as *types*, contents hidden.
Examples (internal): Vigil DNA → {Sentinel, Nocturnix, Wardenmoth};
Tempest DNA → {Galecrest, Stormveil, Aelstrom}; Prism DNA → {Kaleidon,
Spectrarch, Facetra}; Chimera DNA → {Twinmaw, Paradoxa, Amalgamus}.

### Dormant/Ancient
- **Wild-House pets** (unknown model IDs) render as silhouette forms until a
  registry update awakens them. Retired species become **Ancient** class —
  permanent Dex entries, still battle-legal.


## 8. Rebirth & Lineage
- Weekly REBIRTH event = lifespan. Stat carry-over: 30% base, +10% per tier
  reached, cap ~70%. Inherited trait = most-repeated (automatic, stays idle).
- Species affinity by lineage; lineage perks (3× Prism ancestors → **Kaleido** egg);
  **Progenitor** flag for DNA donors.

---

## 9. DNA Fusion (cross-provider)
- Fusion-locked specials unreachable solo. `tt dna export` / `tt dna apply <code>`.
- Apply timing: Sprite/Rookie = species graft (hybrid sub-line, e.g. "Mistral"-
  type lines); Evolved = guaranteed entry into that DNA's published special pool
  next molt; Prime = fusion Apex variant.
- Deterministic published pools (e.g. Vigil DNA → {Sentinel, Nocturnix, Wardenmoth}).
- One DNA application per pet lifetime. DNA merge (breeding) splices trait pools.
- **Cross-provider fusions are first-class:** an Aether-line pet spliced with
  Cipher-house DNA is the flagship Chimera-class content. Hashes carry House genes,
  so provider mix is visible in lineage.
- Grade carries into fusion (S-spliced marker, stat-floor bonus).

---

## 10. Hash / DNA Code System
- Signed compact string at rebirth/export. Encodes species, House genes, trait set,
  pattern, stats, grade, lineage depth, rhythm profile, mutation flags, Progenitor
  count. **Never encodes provider names as logic — only gene IDs** (provider
  anonymity in battle; only the Houses show).
- Format `TT<schema>-<content_min>-<payload>-<sig>`; old clients parse newer hashes;
  unknowns → dormant genes.

## 11. Battle System
- Deterministic: f(hashA, hashB, ruleset_version); ruleset negotiation; replays
  reproducible forever. Cross-provider battles work by construction.
- **Type wheel updated for 4 Houses:** Aether > Cipher > Flux > Forge > Aether
  (content-tunable); Wild is neutral. Trait procs and behavioral counters
  apply (Sprinter counters Marathoner, Deepdiver counters Swarm).
- Grade stat-floor (S ≈ +5%). Archive-record battles supported. Stats: PWR/SPD/WIS/GRT.

## 12. Grades & the Archive (Hall of Fame)

### Grade mechanic (roll-per-evolution, monotonic)
- Every pet hatches at **C**. At **every molt (evolution checkpoint)**, the pet
  rolls a **grade-up chance**: C→B→A→S, one step at a time.
- **Monotonic rule:** grade can only ever increase during a lifetime. It NEVER
  downgrades — not from a bad session, not from Dormancy, not at any molt. A
  failed roll simply keeps the current grade.
- **Chance, never guarantee:** developer activity during that session window
  *raises the odds* of the roll succeeding, but no activity level guarantees a
  grade-up. There is no pity guarantee; every roll can fail.
- **Slimming odds at height (base rates, content-tunable):**
  - C → B: 25% base
  - B → A: 10% base
  - A → S: 3% base
- **Activity modifier (model-neutral):** the same molt-evaluation signals —
  consistency vs your own baseline, trait synergy that window, rhythm quality,
  diversity — scale the base rate by ×0.5 (idle/thin window) up to ×2.0 (an
  excellent window), hard-capped so A→S never exceeds ~6%. Token volume and
  model choice never enter the modifier (pillar 2).
- **Gradeshift moment:** a successful roll plays a molt cutscene where the pet's
  palette visibly upgrades to the new grade live (see §12) — the mid-week
  jackpot moment worth screenshotting.
- At **rebirth**, the lifetime's final grade is what the Archive records; the new egg
  starts back at C (lineage perks may slightly sweeten *roll odds*, never the
  starting grade, and never to certainty).

### Archive records
- One best-record slot per species; record = final grade + final stats.
- Overwrite only if strictly better (grade first, total stats tiebreak).
- **New record → new DNA code**; old shared codes stay valid (superseded socially).
- S-grade DNA still confers the fusion stat-floor + S-spliced marker (§8).
- Records store `(species_id, grade, stats, content_version, hash)`;
  `graded_under: vN` tags; never retroactively demoted. "???" rows advertise updates.
- **RESOLVED:** the in-game record registry is named the **Archive**
  (avoids collision with OpenAI Codex). Command: `tt archive`.

```
 ◆ TOKEN TAMERS ARCHIVE — 47/112 unlocked ◆
 ─────────────────────────────────────────
 #014 Mistral      [A]  PWR 72 SPD 91 WIS 64 GRT 80   gen 6   TT2-c14-mK4…
 #022 Nocturnix ★  [S]  PWR 88 SPD 95 WIS 79 GRT 90   gen 11  TT2-c14-x9F…
 #031 Wardenmoth   [B]  PWR 61 SPD 55 WIS 84 GRT 58   gen 4   TT2-c14-qL2…
 #045 ???          [—]  dormant gene — update to awaken
```

## 13. Visual Design — lightweight, richly animated, grade-driven beauty

**Goal:** genuinely beautiful colorful pixel-art pets in the terminal, with grade
determining visual *richness* (S = the most beautiful), at <1% CPU.

### Art direction: modern high-density monster sprites
- **Style target:** modern high-density monster-sprite production quality —
  high color density, rich shading, vibrant saturated palettes, expressive
  silhouettes. **Original creature designs only.** Every pet must pass a
  "clearly its own monster" check; no resemblance to existing franchise
  creatures, poses, or signature palettes.
- **Sprite resolution upgraded:** 48×48 to 64×64 pixels per pet (Apex/fusion
  forms at 64×64). Via half-blocks that's a 64×32-cell render — still tiny text.
- **Density techniques:** quadrant blocks (`▘▝▖▗▚▞`) where sub-cell shaping helps
  silhouettes; ordered dithering for smooth shading ramps; 1px dark outlines with
  selective anti-alias pixels for the "modern sprite" crispness; rim-light pixels
  on the silhouette edge (the signature modern-sprite pop), budgeted by grade
  (S gets animated rim light).
- **Shading depth per grade** rides the beauty ladder below — C is flat-shaded,
  S gets full ramp shading + specular highlights.

### Rendering technique
- **Half-block pixel rendering:** sprites drawn with `▀` cells — fg color = top
  pixel, bg color = bottom pixel → 2 vertical pixels per cell. A 32×32-pixel pet
  fits 32×16 cells and reads as true colorful pixel art (chafa-style). Braille
  chars layer fine details (whiskers, sparkles).
- **Palette indirection:** sprite assets store palette *indices*, never RGB.
  Grade + House select the LUT at render time → one asset, many beauty levels.

### Grade beauty ladder (richness, not just hue)
| Grade | Name    | Base accent | Visual budget                                              |
|-------|---------|-------------|-------------------------------------------------------------|
| C     | Slate   | `#8b8b8b`   | Flat 4-color palette, 2-frame idle. Charming, plain.        |
| B     | Verdant | `#4ade80`   | 8-color palette, 1 highlight tone, 3-frame idle + blink.    |
| A     | Violet  | `#a78bfa`   | 16-color palette, static dithered gradient shading, occasional sparkle glint. |
| S     | Aurum   | `#fbbf24`   | Full 24-bit gradient ramps; animated shimmer sweep (gold→amber→white traveling highlight); **particle aura** (drifting `✦ · ˚` sparkles); breathing outline glow. Visibly alive & luminous. |

- House tint = base hue family of the body; grade = color depth + motion budget.
- **Grades change mid-life (§11):** the renderer hot-swaps the grade LUT on a
  Gradeshift — same sprite asset instantly re-renders richer, with a burst
  cutscene (flash + falling sparkles) marking the upgrade.
- Mutations hue-shift; fusion specials two-tone split per parent; S-spliced = gold
  outline. Badges always shown: `[S]★ [A]◆ [B]● [C]○`.
- Degradation ladder: truecolor → 256-color quantized → 8-color + badges → pure
  ASCII (`--no-color`). Beauty scales down; information never disappears.

### Lightweight by architecture
- **Diff renderer:** front/back buffers; emit ANSI only for changed cells. Idle
  pet redraws ~30 cells/frame, never the screen.
- **Precomputed LUTs:** color ramps, shimmer frames, dither patterns baked at
  load — zero per-frame color math or allocation.
- **Layered compositing:** base sprite / aura+particles / UI chrome — only dirty
  layers re-composite.
- **30fps default, slim-first:** fixed-timestep render loop at **30fps default**
  — the sweet spot for terminal animation: smooth shimmer/particle motion at
  roughly half the output and wake-up cost of 60. The diff renderer still does
  the heavy lifting (only changed cells emit ANSI). Animation timing uses an
  accumulator, so motion stays even at any rate.
- **Adaptive down, opt-in up:** if the terminal emulator or SSH link can't
  drain output, coalesce to 15fps automatically — beauty degrades before
  correctness. Idle scenes with little motion drop to an event-driven ~10fps;
  cutscenes/battles run the full 30. A `render.fps: 60` config opt-in exists
  for users who want max smoothness and accept the cost — never the default.
- **Slim guarantees:** per-frame budget ~2ms; frame-skip when unfocused /
  `tt watch` background; daemon never renders. CPU target ~1–2% at 30fps
  foreground, ~0 with no viewer open.
- **Tiny assets:** palette-indexed pixel grids → a full species (all stages +
  frames) is a few KB of JSON; 100+ pet content packs stay light.

### Animation set
- Sprite packs: `{species_id, stage, frames(palette-indexed grids), fps, anchors}`.
- Idle loops per grade (accumulator timing; above); trait-flavored idles (Nightshade sleeps in your
  daytime). Molt cutscene = crack & re-form; fusion = parents slide in, overlap,
  white flash, two-tone reveal (the signature fusion cinematic). Battle view split-pane: HP
  bars, lunges, screen-shake, floating damage — pure playback of the resolved log.

## 14. Habitats & Trinkets (unlockable backgrounds + toys)

Cosmetic depth layer in the spirit of classic virtual-pet devices: the pet lives
in a **Habitat** (background scene) decorated with **Trinkets** (toys/objects) the
player selects. Both are unlockable collections — and strictly cosmetic
(pillar-safe: zero stat, grade, or rarity influence).

### Habitats (backgrounds)
- Rendered as a palette-indexed layer *behind* the pet in `tt`, `tt watch`, and
  battle view. Mostly static cells + a few animated ones (drifting clouds,
  flickering terminal glow, falling leaves, twinkling stars) — costs almost
  nothing under the diff renderer.
- **Live-sync touches:** day/night tint follows the player's real clock; the
  weekly weather seed adds ambient effects (storm week = occasional rain cells).
- Grade aura interacts with the scene (an S-rank's glow softly lights nearby
  background cells).
- **Starter set:** Terminal Den (default), Meadow, Rooftop Night.
- **Unlock sources (achievement-driven, all model-neutral):**
  - First pattern form earned → that pattern's themed habitat
    (Vigil → Midnight Observatory; Tempest → Stormfront; Prism → Refractory;
    Chimera → The Crossroads)
  - House mastery (10 lifecycles dominant in a House) → House habitat
    (Aether Spire, Cipher Vault, Flux Garden, Forge Hollow)
  - Lineage depth milestones (gen 5/10/25) → Ancestral Grove tiers
  - First S-grade record → Gilded Sanctum
  - Surviving a Dormant week → Cocoon Hollow (badge of honor, not shame)

### Trinkets (toys & objects)
- Small sprites placed at anchor slots in the habitat (2–3 slots). The pet's
  **idle animations interact with them**: bats the ball, naps on the cushion,
  stares into the lava lamp, waters the bonsai. Trait-flavored: Nightshade pets
  prefer the cushion at night; Sprinter pets chase the ball more.
- Purely cosmetic — trinkets influence *which idle animations play*, never stats.
- **Unlock sources:** trait milestones (earn Marathoner ×5 → Tiny Treadmill),
  molt-count lifetime milestones, weather-week participation, first DNA export
  (Gift Box), first fusion (Twin Orb), Archive page completion (Trophy
  Shelf), seasonal weather weeks (limited-window unlocks, still re-earnable
  later — nothing is ever permanently missable).

### Selection & idle-friendliness
- `tt deco` — pick habitat + trinket slots; `tt deco --auto` (default) curates
  automatically from the pet's traits/House so pure-idle players still see
  variety without ever touching it.
- Loadout stored in local config; battle view shows each side's own habitat
  behind their pet (flex layer); the rebirth hash carries a `habitat_id` flag so
  shared codes display in their home scene.

### Content & versioning
- Data packs: `content/vN/habitats.json`, `trinkets.json` — same palette-indexed
  sprite format, same additive-only ID rules; unknown habitat IDs in a hash
  render as the default scene (graceful, version-agnostic).
- Unlock conditions are declarative data (`{unlock: {type: "pattern_first",
  id: "vigil"}}`) so new collections ship without engine changes.


### Achievements (the completionist spine)
Achievements are the formal layer that couples progression to the habitat &
trinket collections — every achievement grants something tangible:

- **Registry:** `content/vN/achievements.json` — declarative
  `{id, name, condition, reward: {habitat|trinket|title|dex_flair}}`;
  additive-only IDs like everything else. Evaluated locally by the daemon at
  molt/rebirth events; no achievement ever requires network, purchases, or a
  specific model.
- **Categories (v1 ≈ 120 achievements):**
  - *Lineage:* generations reached, carry-over milestones, Kaleido hatched
  - *Evolution:* each stage reached, each House Apex, each hybrid line,
    each pattern variant earned
  - *Traits:* earn each trait once / ×10 lifetime; full trait sheet in one life
  - *Rhythm:* Disciplined/Burnout/Nocturne variants raised; Dormancy survived
  - *Grades:* first B/A/S; S in each House (grade gates achievements — but the
    goal is the achievement, completing the page, not the grade itself)
  - *Social:* first DNA export/apply/merge; each DNA pool entered; Progenitor
    counts; battles fought/won via exchanged codes
  - *Collection meta:* Dex 25/50/75/100%; habitat & trinket set completion
  - *Calendar:* weather-week participation set (all re-earnable, never missable)
- **Completion Meter:** `tt complete` shows the single number that defines the
  game — overall % = weighted union of Dex, achievements, habitats, trinkets —
  with per-page breakdowns. The endgame is driving this to 100%.
- **Titles & flair:** some achievements grant lineage titles ("Four-House
  Master") and Dex flair (border styles) that ride along in shared hashes.


## 15. Technical Architecture

### TUI shell: clickable, 4:3 canvas, bottom menu
**Layout law:** the game renders in a **4:3 game canvas** with the **menu bar
OUTSIDE the canvas, docked at the bottom** of the terminal. All UI is
mouse-clickable — menu first and foremost — with full keyboard parity.

- **4:3 canvas math:** cells aren't square (~1:2 w:h), and half-blocks give
  2 vertical px per cell — so a 4:3 *visual* canvas uses a cols:rows grid of
  ~8:3 (e.g. 128 px × 96 px → 128 cols × 48 rows; small terminals scale to
  80×30, minimum 64×24). On launch/resize the shell computes the largest 4:3
  pixel area that fits above the menu bar and letterboxes the remainder with
  habitat-tinted gutters. Canvas hosts: pet + habitat + trinkets, cutscenes,
  battle view, and full-screen pages (Dex, Achievements) drawn inside the same
  frame.
- **Bottom menu bar (1–2 rows, outside canvas):**
  `[♥ Pet] [☰ Dex] [★ Achv] [⌂ Deco] [🧬 DNA] [⚔ Battle] [⚑ League] [⚙] · 67.4%`
  Always visible, never overlaps the canvas; right edge shows the live
  Completion Meter. Click to switch pages; active page highlighted; hover
  highlight on mouse-move.
- **Mouse support:** enable SGR mouse reporting (`CSI ?1000;1002;1006 h`) in
  raw mode; parse press/release/move/wheel; a **hit-region registry** is
  rebuilt from the layout tree each frame, so every interactive element —
  menu buttons, tabs, Dex rows, achievement cards, deco slots, scrollbars —
  is clickable. Wheel scrolls lists; click-drag on the Dex scrolls; click a
  Dex entry → detail card; click trinket slot in Deco → picker.
- **Keyboard parity & fallback:** every click has a hotkey (menu = F1–F8 or
  number keys, arrows + enter everywhere); if the terminal lacks mouse
  reporting (some SSH/older emulators), the game is 100% playable by keys and
  shows hotkey hints in the menu labels.
- **Idle purity preserved:** the entire UI remains optional — clicking is for
  browsing collections and decor; nothing gameplay-critical ever requires
  input (pillar 1).
- **Slim:** mouse parsing is a few hundred bytes of escape-sequence handling;
  hit-testing is rectangle lookup; zero impact on the 30fps budget.

```
┌──────────────────────────────────────────────┐
│ ╔══════════════ 4:3 CANVAS ══════════════╗   │
│ ║   habitat · pet · trinkets · pages     ║   │  <- letterbox gutters
│ ║                                        ║   │     (habitat-tinted)
│ ╚════════════════════════════════════════╝   │
├──────────────────────────────────────────────┤
│ [♥Pet][☰Dex][★Achv][⌂Deco][🧬DNA][⚔Btl][⚙] 67%│  <- clickable menu (outside)
└──────────────────────────────────────────────┘
```

### Stack & toolchain (TypeScript + pnpm, finalized)
**Decision: custom slim TUI core on Node — no TUI framework.**
Evaluated (June 2026): Ink v6 (pure Node but ~50MB React overhead, hardcoded
fps cap, no built-in mouse — we'd bypass it for the canvas and hand-roll mouse
anyway) and OpenTUI (excellent native-Zig performance, powers OpenCode, but
requires Bun or Node 26.3 experimental FFI + per-platform native binaries —
conflicts with pnpm/Node-LTS and slim `npm i -g` distribution). Our UI is two
fixed regions + an in-canvas page system and a bespoke diff renderer — exactly
the part frameworks don't provide. A custom core gives **zero runtime
dependencies** (privacy/trust badge; makes the zero-network CI trivial), no
native binaries, works on any Node LTS over any SSH. OpenTUI is the documented
fallback if the renderer hits a wall.

- **Language/runtime:** TypeScript 5.x `strict`, ESM only, Node >= 20 LTS
  (`engines` enforced); zero runtime dependencies target
- **Package manager:** pnpm 9 workspaces (`packageManager` field pinned;
  corepack)
- **Workspace layout:**
  - `packages/core` — engine, cycle policies, grade rolls, hash codec (pure,
    deterministic, no I/O)
  - `packages/tui` — shell: frame buffer, diff renderer, half-block compositor,
    SGR mouse parser, hit-region registry, page router
  - `packages/adapters` — claude-code / codex / opencode (one entry each)
  - `packages/content` — content packs + pack validator types
  - `apps/cli` — the `tt` binary wiring everything (daemon, init, commands)
- **Build:** tsup (esbuild) → single bundled `dist/tt.js` with `bin: { tt }`;
  `tsx` for dev runs; source maps in releases
- **Quality:** Vitest (unit + golden-frame renderer tests: render to a string
  buffer, snapshot-compare — TUIs are very testable this way), **ESLint
  (flat config + typescript-eslint, type-aware rules)** + Prettier for
  formatting, `tsc --noEmit` in CI. ESLint also carries the custom
  AI-guardrail rules natively: import-boundary enforcement via
  `eslint-plugin-import` / `no-restricted-imports` (core imports nothing;
  tui/adapters import core only, never each other) and restricted-syntax
  rules banning `Date.now()`/`Math.random()` inside `packages/core`
- **CI gates:** test · typecheck · lint · `npm audit --omit=dev` ·
  zero-network grep · docs spoiler check
- **TUI-core scope (the part to hand-build, in order):** ANSI writer +
  alt-screen/raw-mode lifecycle -> cell frame buffer + diff flush ->
  half-block sprite compositor -> input decoder (keys, then SGR mouse) ->
  hit-region registry -> 4:3 layout + page router. Each step is independently
  golden-frame testable.

### Adapter layer
```
[claude-code adapter]──┐
[codex adapter]────────┼──▶ normalized UsageEvent stream ──▶ daemon engine
[opencode adapter]─────┘
```
- **UsageEvent (normalized):** `{ ts, adapter, model_id, input_tokens,
  output_tokens, cache_read, cache_write, reasoning_tokens?, session_key,
  is_subagent, cwd?, lang_hints? }`
- Adapters are versioned plugins shipped like content packs (format drift in any
  provider = adapter patch, not engine change). Each adapter handles its quirks:
  - claude-code: JSONL tail, subagent files, 30-day deletion → incremental ingest
  - codex: cumulative `token_count` → delta computation; 3 format generations;
    `archived_sessions/`; sessions/ wins over archive on duplicates
  - opencode: per-message JSON tree walk; `OPENCODE_DATA_DIR` multi-root;
    project/global storage split; prune-tolerant ingestion
- Engine consumes only UsageEvents + CyclePolicy events; it is provider-blind.

### Daemon / observer
- Read-only; never calls any API; never spends quota.
- Simulation decoupled from rendering: daemon ticks → local SQLite/JSON store;
  TUI is a stateless subscriber. Incremental file watching (mtime/offset
  bookkeeping per file, like ccusage's scanner).

### Render modes & CLI (updated)
`tt init` · `tt` (the clickable 4:3 shell — all pages live inside it) · `tt watch` · `tt status` · `tt archive` · `tt dex` ·
`tt battle` · `tt dna export` · `tt dna apply <code>` · `tt adapters` (health/paths)
Statusline one-liner: `🥚→ Nocturnix [S]★ molt 7 ▓▓▓░`

### Version-agnostic rules
1. Content as data (species/traits/pools/**models.json**/rules in versioned JSON).
2. Self-describing hashes. 3. Dormant genes (now also for unknown model IDs).
4. Versioned deterministic battle engine + ruleset negotiation.
5. Additive-only registries; retired pets become "Ancient".
6. **NEW:** Adapters versioned independently of content and engine.

## 16. Motivation Stack
Daily idle growth → weekly arc/rebirth → social DNA/battles/weather → the
year-long completionist climb: Dex, achievements, habitats, trinkets — one
Completion Meter to drive to 100% (grades flavor the journey, completion IS
the goal). Better records mint better DNA →
better DNA breeds better lineages.

## 17. Repository, Dev Tooling & Documentation

### Repo layout
```
token-tamers/
├── CLAUDE.md                  # project memory for Claude Code (see below)
├── .claude/
│   └── skills/                # project-specific Claude Skills (see below)
├── packages/
│   ├── core/                  # engine (pure, deterministic)
│   ├── tui/                   # shell, renderer, mouse, hit-regions
│   ├── adapters/              # claude-code / codex / opencode plugins
│   └── content/               # versioned packs: species, traits, models.json,
│                              #   DNA pools, sprites (palette-indexed JSON)
├── apps/
│   └── cli/                   # the `tt` binary (daemon + commands)
├── pnpm-workspace.yaml
├── docs/
│   └── wiki/                  # in-depth GitHub wiki source (synced to repo wiki)
└── tools/                     # sprite compiler, hash inspector, pack validator
```

### CLAUDE.md (project memory)
Root-level CLAUDE.md so any Claude Code session on the repo knows the rules:
- Architecture map (adapter → UsageEvent → engine → store → TUI) + key paths
- **Non-negotiable invariants:** read-only observer (never call AI APIs / never
  spend quota); **zero network code anywhere** (no fetch/telemetry/update
  checks — CI greps for network imports and fails the build); no-model-judgment pillar; additive-only registries; hashes must
  stay parseable forever; content-as-data (never hardcode species/models)
- Conventions: content-pack schema versioning, adapter interface contract,
  deterministic-engine rules (no Date.now()/Math.random() in battle code)
- Test commands, pack-validation commands, release/versioning flow
- **Spoiler rule for contributors:** fusion-pool contents live only in
  `content/**` and must never be written into docs/wiki (see below)

### Claude Skills (.claude/skills/)
Project skills so Claude Code contributors get expert help automatically:
- **sprite-design** — the art-direction rules (§12): 48–64px grids, palette
  indices only, grade beauty ladder budgets, dither/rim-light guidance,
  originality check ("clearly its own monster"), sprite-compiler usage
- **content-pack** — schema for species/traits/pools/models.json; additive-only
  rules; ID stability; validation tool; how dormant genes must behave
- **adapter-dev** — UsageEvent contract; per-provider quirks (Claude 30-day
  deletion, Codex cumulative deltas + format generations, OpenCode storage tree);
  fixture-based testing of real log samples
- **wiki-writer** — docs style; what is public vs hint-only (special pets);
  keeps wiki in sync with content-pack changes

### AI-Native Development Policy
This project is **built entirely with AI coding agents** (Claude Code first;
contributors may use any AI assistant). That is a feature, not a risk —
PROVIDED the feedback loops below exist. The policy: *humans own architecture
and contracts; CI owns quality and performance; AI writes the code.*

**Known AI-codebase failure modes → mechanical countermeasures:**
- *Architectural drift* → import-boundary lint rules (`core` may import
  nothing but itself; `tui`/`adapters` may import `core`, never each other);
  violations fail CI.
- *Dependency creep* → zero-runtime-deps policy enforced in CI: any
  `package.json` dependency change fails unless linked to an approved issue.
- *Silent perf regressions* → **performance budgets as failing tests**:
  bench suite in CI with hard gates — frame flush < 2ms (reference scene),
  daemon tick budget, RSS ceiling < 40MB, bundle < 1MB (size-limit),
  cold start budget. Regress a budget = red PR, no debate needed.
- *Duplication / dead code* → jscpd + knip advisory gates.
- *Plausible-but-wrong logic* → determinism property tests (hash round-trip
  fuzzing; same inputs = same battle; cross-version replay), golden-frame
  renderer snapshots, adapter fixture suites built from real log samples.
- *Test gaming* → tests assert contracts/invariants (from this doc), not
  current behavior; CLAUDE.md forbids weakening a test to pass a PR.

**Process rules (in CLAUDE.md + CONTRIBUTING):**
- CLAUDE.md + the four skills are the primary review layer — every AI
  contributor's agent reads them before writing code. Keep them current; a
  stale CLAUDE.md is a project bug.
- Small PRs, one concern each; PR template includes the invariant checklist
  (offline, read-only, no-judgment, additive-only, perf budgets, no spoilers).
- Maintainer reviews **boundaries and contracts**; CI reviews everything
  else. This is what makes many parallel AI contributors scalable.
- Performance ceiling lives in the architecture (diff renderer, LUTs,
  event-driven daemon) — contributors implement within a fast design; PRs
  that change the architecture require a design-doc update first.

### GitHub Wiki (docs/wiki/)
In-depth, everything-explained player & contributor wiki, kept in-repo and synced
to the GitHub wiki. Pages:
- Home / philosophy (idle, no-model-judgment pledge, read-only privacy promise)
- Getting started: `tt init`, per-provider setup, plan types, static vs dynamic
  cycles, troubleshooting adapter detection
- Game guide: lifecycle (molts/rebirth/weekly arc/weather), stages, Houses,
  traits table, pattern evolutions, mutations, Dormant state
- Grading & the Hall of Fame: S/A/B/C formula concepts, overwrite rules,
  record→DNA economy
- Battles: type wheel, trait counters, determinism/ruleset negotiation, replays
- DNA & breeding: export/apply mechanics, timing tiers, merge breeding,
  Progenitor legacy, cross-provider Chimera-class fusions
- Hash format spec; content-pack authoring; adapter authoring; architecture
- **Special pets policy: HINT, NEVER REVEAL.** The wiki documents *that*
  fusion-locked specials exist, the apply-timing tiers, and which DNA *types*
  exist — but never pool contents, special names, sprites, or stats. Each DNA
  type's page carries only a riddle-style hint (e.g., Vigil DNA: "those who
  watch through the night are watched back…"). Dex "???" silhouettes only.
  Discovery is community content; datamining is inevitable but the official
  docs never spoil. Enforced by the wiki-writer skill + CLAUDE.md spoiler rule
  + CI check (no special-pool IDs may appear under docs/).


## 18. MVP Scope (v1.0)

### In scope — MVP (milestone M1)
1. `tt init` wizard: adapter detection, plan type, cycle policy, week anchor,
   backfill baseline, Calibration Egg
2. **Claude Code adapter** (reference) + the adapter interface contract
3. Cycle policies: dynamic (subscription) + static (API), molt/rebirth events
4. Core evolution: Houses via models.json, stage track to Apex, traits,
   pattern locking, mutations, grade roll system (monotonic, odds-transparent)
5. Rebirth + lineage carry-over; Archive records (best-per-species)
6. TUI shell: clickable 4:3 canvas, bottom menu, Pet + Dex + Archive pages;
   30fps renderer with half-block sprites, grade beauty ladder, Gradeshift
7. Starter content pack: Aether + Cipher lines complete (egg→Apex), 3 habitats,
   6 trinkets, ~30 achievements, Completion Meter
8. `tt watch` + statusline one-liner; `--no-color` fallback
9. CLAUDE.md + the four project skills; docs/wiki skeleton + CI spoiler check;
   CI zero-network check

### Post-MVP (M2)
- Codex CLI + OpenCode adapters; Flux + Forge lines; hybrid lines
- Hash export/import; battles; DNA fusion + pools; Drifter DNA; Team Leagues
- Habitat/trinket full sets; remaining achievements; Deco/DNA/Battle/League pages

### Post-MVP (M3 / live)
- Season 1 content pack; monthly weather events; Legacy milestones
- Sprite compiler pipeline; pattern-variant art completion


## 19. One-Year Retention Assessment (honest)

**Verdict: the current design reliably holds a dev with colleagues for ~4–6
months. A full year requires the seasonal cadence below — added to plan.**

### What carries retention (strong)
- Weekly rebirth = a natural appointment loop; lineage makes weeks compound.
- Grade-roll rarity (A→S ≤6%) makes S a months-scale chase with visible payoff.
- DNA economy turns teams into content; new-record→new-DNA keeps trading alive.
- Zero-effort idle floor: even disengaged players accrue lineage, so re-entry
  is always warm (come back to gen 14, not a dead save).

### Honest risks
1. **Wallpaper risk:** pure-idle games fade into the background once novelty
   dips (~week 6–10) unless periodic *external* novelty arrives.
2. **Battle shallowness:** deterministic, no-input battles are a spectator
   feature; without standings they're a one-week toy.
3. **Solo-dev cliff:** no colleagues → no fusion third → Dex ceiling ~65%.
4. **Content exhaustion:** 112 entries; a dedicated team Dex-completes in
   ~6–9 months without new packs.
5. **RNG frustration:** monotonic grades prevent loss-aversion pain, but long
   S droughts can read as "the game ignores my effort" — communicate odds
   transparently in-UI.

### Year-One Retention Plan (now in scope)
- **Quarterly content packs** (Seasons): +1 hybrid line, +6–10 species,
  +1 habitat set, +1 DNA pool, +1 achievement page per quarter — additive-only,
  hash-safe, **bundled in app releases the user installs** (the game never
  fetches content itself).
- **Monthly weather events:** one special week per month with a unique
  re-earnable trinket/habitat and a twisted trait table.
- **Team Leagues (opt-in):** weekly standings computed locally from hashes
  colleagues paste to each other (`tt league import <codes>`); any human channel
  works — chat, a text file, a sticky note. The game itself never transmits or
  receives anything. Seasonal league titles recorded in lineage.
- **Legacy milestones:** year-scale lineage achievements (Gen 25/52, "Four-House
  Master", "Perfect Season") with Ancestral habitat tiers as rewards.
- **Solo-dev bridge:** monthly "Drifter DNA" — generated **locally** by
  `tt dna drifter` from the deterministic calendar seed. Every machine on the
  same month produces the identical code, fully offline — solo players get a
  rotating slice of fusion content with zero network and zero publishing.
- **Transparency UI:** show current grade-up odds + modifier at every molt
  (defuses RNG resentment; respects the no-guarantee rule).
- **12-month content calendar** drafted before launch; packs prepared one
  season ahead.


## 20. Implementation Backlog (tracked as GitHub issues from day one)
- [ ] Grade roll tuning: base rates, activity-modifier weights, caps, optional
      sub-certainty soft-pity (must never reach guarantee), anti-gaming caps
- [ ] Molt evaluation spec: per-adapter field parsing + normalization math
- [ ] Codex adapter: delta algorithm + format-generation detection spec
- [ ] OpenCode adapter: storage-tree walk + prune-tolerance spec
- [ ] Static-policy edge cases: timezone changes, DST, week-anchor migration
- [x] Full evolution tree v1 (§7) — sprites pending
- [ ] 12-month content calendar + Season 1 pack outline
- [ ] Team League standings format + local Drifter DNA generation spec
- [ ] achievements.json v1: full 120-achievement list + reward mapping
- [ ] Completion Meter weighting formula
- [ ] First fusion pool lineup; Chimera-class pool design
- [ ] models.json v1 pattern list (major hosted + open-weight model-ID families)
- [ ] Content schema draft; hash payload spec + signing scheme
- [ ] Battle math: damage formula, proc rates, House-wheel multipliers
- [ ] Page-by-page mockups inside the 4:3 shell (Pet/Dex/Achv/Deco/DNA/Battle/League)
- [ ] Mouse hit-region registry design + SGR parser edge cases (tmux passthrough,
      mosh, Windows Terminal)
- [ ] Golden-frame test harness for the renderer (string-buffer snapshots)
- [ ] pnpm workspace + tsup + ESLint(+Prettier) + Vitest scaffold (first Claude Code task
      after CLAUDE.md)
- [ ] CI bench harness + initial perf budgets; size-limit config; import-
      boundary rules; dependency-change gate; jscpd/knip advisory
- [ ] Rename in-game "Codex" (collision with OpenAI Codex): Archive/Chronicle/Bestiary?
- [ ] Name/namespace availability check for "Token Tamers" (npm, GitHub, app registries)
- [ ] README pledge text for "no model judgment" + "read-only, never spends tokens"
- [ ] Windows path support (%USERPROFILE% variants for all three adapters)
- [ ] Future adapters: Gemini CLI, Copilot CLI, Amp, Goose, Cursor
- [ ] Write CLAUDE.md v1 + the four project skills (sprite-design, content-pack,
      adapter-dev, wiki-writer)
- [ ] Wiki page skeletons in docs/wiki + CI spoiler check (no special-pool IDs
      under docs/)
- [ ] Riddle-hint copy for each DNA type
- [ ] Sprite compiler tool (PNG/Aseprite -> palette-indexed JSON) for the
      48-64px pipeline
- [ ] Habitat/trinket v1 art list + unlock-condition schema; idle-interaction
      animation matrix (trait x trinket)
