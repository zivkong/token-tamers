# DNA Fusion, Hash/DNA Code System, and Battle System

This page is a faithful reorganization of sections §9, §10, and §11 from the Token Tamers v1.0.3
design baseline. Every rule, number, table, name, list item, example, caveat, rationale, and
parenthetical from those sections is preserved verbatim or with minimal structural reordering.
Where items are noted as "TODO" or "content-tunable" in the source, they remain so here.

---

## §9 — DNA Fusion (design baseline §9)

### Commands

- `tt dna export` — generate and display the pet's current DNA code.
- `tt dna apply <code>` — apply a DNA code from another pet to this one.

**Scope (2026-06-16 rescope): the `tt dna` command surface and the whole grafting/fusion system
below are Season 1 ("Crossbreed") — milestone M2.3, not yet built.** The DNA _codec_ is shipped
(M2.1), and Season 0's Battle system consumes a decoded code read-only (you can battle a pasted
code without applying it), but `export`/`apply` and everything in this §9 land in Season 1.

### Apply-Timing Tiers by Stage

The effect of applying DNA depends on the receiving pet's current stage:

| Receiving stage | Effect of applying DNA                                                             |
| --------------- | ---------------------------------------------------------------------------------- |
| Sprite / Rookie | Species graft — hybrid sub-line, e.g. the "Mistral"-type lines (Aether×Flux cross) |
| Evolved         | Guaranteed entry into that DNA's published special pool at the next molt           |
| Prime           | Fusion Apex variant                                                                |

### Deterministic Published Pools — By Type

One pool exists per DNA type. Pool **types** are public; pool **contents** are internal and must
not appear in docs. Pool contents are internal — see
`packages/content/content/fusion-pools.json`.

| DNA type  | Published type name | Public riddle hint                                             |
| --------- | ------------------- | -------------------------------------------------------------- |
| `vigil`   | Vigil DNA           | "those who watch through the night are watched back…"          |
| `tempest` | Tempest DNA         | TODO riddle copy (backlog: riddle-hint copy for each DNA type) |
| `prism`   | Prism DNA           | TODO riddle copy (backlog: riddle-hint copy for each DNA type) |
| `chimera` | Chimera DNA         | TODO riddle copy (backlog: riddle-hint copy for each DNA type) |

Each pool type corresponds to a pattern evolution that locks at the week's final molt (§6):

- Vigil DNA → unlocked by the Vigil pattern (Marathoner + Nightshade).
- Tempest DNA → unlocked by the Tempest pattern (Sprinter + Swarm).
- Prism DNA → unlocked by the Prism pattern (any 4 distinct traits).
- Chimera DNA → unlocked by the Chimera pattern (Polyhost + Switcher), the multi-agent flex form.

Fusion-locked specials are unreachable solo — they require applying DNA received from another
player.

### One Application Per Lifetime

DNA may be applied **at most once per pet lifetime**. A pet that has received a DNA application
cannot receive another until it rebirths.

### DNA Merge Breeding

Applying DNA also **splices trait pools**: the recipient's trait pool is merged with traits
carried in the donor DNA code. This is the breeding mechanism — lineage traits from both sides
become available for future molt rolls.

### Cross-Provider Fusions as First-Class

Cross-provider fusions are explicitly first-class content, not an edge case:

- An Aether-line pet (raised on `claude-*` model genes) spliced with Cipher-house DNA (raised on
  `gpt-*`/`o*` model genes) produces the flagship **Chimera-class** content.
- Hashes carry House gene information, so the provider mix is visible in the resulting pet's
  lineage record.
- A Codex dev can fuse DNA with a Claude Code dev; an OpenCode dev can fuse with either. The
  engine is provider-blind by construction (§10 provider-anonymity rule).

#### Chimera-Class Flagship Note

The Chimera-class line (`Chimera Mistralis` and equivalent Chimera-pattern variants across
applicable Prime/Apex species) is the thematic reward for multi-agent, cross-provider work. The
Polyhost trait (meaningful usage from 2+ provider adapters in one window) combined with the
Switcher trait (changed model IDs mid-session) locks the Chimera pattern. Chimera DNA is the pool
that flows from this form. This is the design's statement that no provider is privileged and that
multi-provider workflows produce unique, unreachable content.

### Grade Carry / S-Spliced Marker / Stat-Floor Bonus

The donor pet's grade at time of export carries into the DNA code:

- **Grade carries into fusion.** The grade recorded in the donor's DNA hash is preserved and
  visible to the recipient.
- **S-spliced marker.** If the donor was grade S at export, the resulting fused pet receives an
  **S-spliced** marker. This marker is visible in the Archive display
  (`[S]★ … TTX1-AFAA-21QC-…`) and in battle view.
- **Stat-floor bonus.** An S-grade DNA code confers a stat-floor bonus on the fused pet (see §11,
  grade stat-floor ~+5%). Non-S DNA codes do not carry this bonus.
- S-grade DNA still confers the fusion stat-floor + S-spliced marker when used as a fusion
  ingredient (also noted in §12 Archive records: "S-grade DNA still confers the fusion stat-floor
  - S-spliced marker").

### Graft Potency by Donor Grade (implemented spec — `GRAFT_POTENCY`)

How much a grafted DNA code can move the recipient scales with the **donor's recorded grade**,
and the lowest grade does nothing at all. This is grade-based ONLY — never model- or
volume-derived (Design Pillar 2 / invariant 3) — and every value is a small, hard-capped nudge,
never a power spike (it mirrors the capped vitality bonus, `VITALITY_MAX_BONUS` = 0.15, in §12):

| Donor grade | Effect (tier)    | `gradeUpChance` | `statBoostFrac` |
| ----------- | ---------------- | --------------- | --------------- |
| C           | none (zero)      | 0.00            | 0.00            |
| B           | small            | 0.02            | 0.02            |
| A           | moderate         | 0.05            | 0.05            |
| S           | small (hard cap) | 0.08            | 0.08            |

- **`gradeUpChance`** is an additive bonus to the recipient's grade-up roll at graft time; it sits
  far below the C→B base odds (0.25), so it can never dominate.
- **`statBoostFrac`** is applied at graft time as a **battle-only stat floor** (the §11 grade
  stat-floor mechanism) OR a budget-preserving redistribution — NEVER a permanent flat add to all
  four stats, so horizontal evolution's **equal total stat budgets** (Design Pillar 3) are
  preserved.
- These are tunable defaults living as named constants in `packages/core/src/engine/constants.ts`
  (`GRAFT_POTENCY`, `GRAFT_GRADE_BONUS_CAP`, `GRAFT_STAT_BOOST_CAP`). The pure `graftPotency(grade)`
  helper exposes them now so the Dex detail view can surface a record's graft tier; the fusion
  engine that consumes them is M2.3 work — **Season 1 ("Crossbreed")**.

### Battle / Graft Readiness Gate (implemented — `BATTLE_READY_STAGE` = Evolved)

To prevent too-early battles and DNA-graft farming from fresh hatchlings, a pet/record is
**battle-ready AND graft-ready only once it has reached the Evolved stage** (egg → sprite → rookie
→ **evolved** → prime → apex — roughly the midpoint of the ~5-day climb, always eventually
reachable). Below the gate the DNA code still shows but battle/graft are **sealed**. Readiness is
derived purely from the snapshot's `stage`, which the DNA encodes, so a foreign code's readiness is
tamper-evident (`stageMature` / `isBattleReady` / `isGraftReady` in `engine/maturity.ts`). The
battle and graft gates share one threshold today but are separate functions so they can diverge
later.

---

## §10 — Hash / DNA Code System (design baseline §10)

### What the Hash Encodes

A DNA code is a **signed compact string** generated at rebirth and/or DNA export. It encodes all
of the following:

- Species
- House genes (the full gene diet profile — which model-ID Houses contributed)
- Trait set
- Pattern (Vigil / Tempest / Prism / Chimera, if locked)
- Stats (PWR / SPD / WIS / GRT)
- Grade (C / B / A / S) and whether S-spliced
- Lineage depth (generation count)
- Rhythm profile (Burnout / Disciplined / Nocturne variant)
- Mutation flags
- Progenitor count (how many times this lineage has donated DNA)

### Provider-Anonymity Rule

**The hash never encodes provider names as logic — only gene IDs.**

Provider identity is deliberately hidden in the battle and trading layer. Only the Houses show.
A pet raised on `claude-*` genes carries Aether House genes; a pet raised on `gpt-*`/`o*` genes
carries Cipher House genes. The House is visible; the specific provider is not surfaced as a
named field in the code. This preserves provider parity (Design Pillar 5) and means that
cross-provider battles are fought House-vs-House, not brand-vs-brand.

### Format

The shipped format is an **opaque, license-key-style token** (revised from the baseline's
`TT<schema>-<content_min>-<payload>-<sig>` sketch per maintainer decision — same semantic content,
a "proper encoded" presentation):

```
TTX<v>-XXXX-XXXX-…        e.g.  TTX1-AFAA-21QC-V22T-E5V9-GV2R-2W7S-6SG1-WBS2-NJAF-C
```

| Field    | Meaning                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------- |
| `TTX`    | Fixed prefix; identifies the string as a Token Tamers exchange code                                  |
| `<v>`    | Visible format version; increments when the payload encoding changes (mirrors the inner `formatVer`) |
| `XXXX-…` | A single high-entropy body in Crockford base32, dash-grouped every 4 chars                           |

The body decodes to `[ integrity-tag:4 ][ whiten(payload) ]`. The **payload** is a flat
unsigned-varint stream in a FIXED, APPEND-ONLY field order — `formatVer`, `content_min` (the
Season floor — backend/technical, encoded inside the payload), species `num`, grade, stage, house, PWR/SPD/WIS/GRT,
generation, pattern, rhythm, length-prefixed trait and mutation lists, then a reserved **extension
length** (`extLen` = 0 today; future TLV data appends here). Each enum encodes as its index in the
append-only `dna/registry.ts` tables. The **integrity tag** is a deterministic FNV-1a/32 over the
payload; it also seeds a **whitening keystream** (mulberry32) XORed over the payload so the token is
high-entropy with no tell-tale zero runs — obfuscation, NOT encryption (a shared code carries no
secret; the seed travels with it so any client can decode).

Now implemented (M2.1 scope) in `packages/core/src/dna/`: the **encoder** `encodeDna` and a pure
inverse `decodeDna` are pure, deterministic (same snapshot ⇒ same code, so the Dex can render it
live and battles/replays are reproducible), and have no I/O — no `node:*`, a hand-rolled base32 and
keystream, not `Buffer`. A golden test locks the byte layout forever; future schema bumps only
append fields / TLV records and add new golden codes. The battle engine (Season 0, M2.2) consumes
decoded codes read-only; the grafting/fusion engine (Season 1, M2.3) is what _applies_ them. Until
those ship, the code is display/share-only.

### Forward-Compatibility Parsing Rules

The hash format is designed so that **every hash ever shared stays valid forever** (Design
Pillar 4):

- **Old clients parse newer hashes.** When a client encounters a schema version higher than it
  knows, it extracts what it can and marks unknown fields as dormant genes or unknown content.
- **Unknown species/genes → dormant genes.** Content not present in the client's installed pack
  renders as a silhouette / "???" entry. This is the same dormant-gene mechanism used for
  unrecognized model IDs (§6, Wild House). The hash is never rejected.
- **`graded_under: vN` tags** in Archive records ensure grades are never retroactively demoted
  when content rules change. Records store `(species_id, grade, stats, content_version, hash)`.
- **Additive-only registries** ensure IDs used in old hashes never collide with new content.
- **"???" rows** in the Archive advertise that an update would awaken dormant entries.

---

## §11 — Battle System (design baseline §11)

> **Status (2026-06-16): IMPLEMENTED (Season 0, M2.2).** The battle engine ships in
> `packages/core/src/battle/` (`simulateBattle(a, b, ruleset)` → a deterministic, replayable
> `BattleResult` timeline), the ruleset is **content data** on `ContentPack.battle`
> (`BattleRuleset`: the House `wheel`, trait `procs`, `variance`, and the negotiated
> `version` — `packages/content/content/battle.json`), and it is surfaced by `tt battle [code]`
>
> - the Battle TUI page (reached from the Archive with `b`, or launched straight into playback
>   by the CLI). Battle consumes a decoded snapshot **read-only** — it never mutates the pet, its
>   grade, or the Dex (invariants 1 & 3). The grade stat-floor lives in `engine/constants.ts`
>   (`GRADE_STAT_FLOOR`, battle-only). DNA **apply/graft/fusion** remains Season 1.
>
> **Self-mirror rule.** You cannot battle (or, in Season 1, graft) your OWN pet against your OWN
> record of the **same species** — a self-mirror is disallowed (`sameSpecies` in `battle/`). A
> same-species match is allowed only against ANOTHER player (a pasted foreign DNA code, whose
> decoded `speciesId` is empty, so it's never a self-mirror). Different species — yours or a
> foreign code — is always allowed.

### Determinism Formula

Battles are fully deterministic:

```
outcome = f(hashA, hashB, ruleset_version)
```

The same two hashes replayed against the same ruleset version always produce the identical
outcome, frame by frame. There is no RNG seeded from wall-clock time, no network call, and no
per-session state. This is enforced by the determinism property tests in CI (same inputs = same
battle; cross-version replay).

### Ruleset Negotiation

When two players exchange hashes to battle, the **ruleset version** is agreed upon explicitly.
Both clients must support the same ruleset version to produce matching replays. The format is
forward-compatible: a newer client can speak older ruleset versions. This is the same
version-agnostic philosophy as the hash codec.

### Replays

Because battles are deterministic functions of the two hashes and a ruleset version, **replays
are reproducible forever** — a battle result can be re-simulated by anyone who holds both codes
and knows the ruleset version used. No replay file needs to be distributed; the codes are
sufficient. Archive-record battles are supported (a best-record hash from the Archive can be
used as one side of a battle).

Cross-provider battles work by construction: since hashes carry House genes rather than provider
names, and the battle formula operates on Houses/stats/traits, there is no provider-specific logic
to reconcile.

### The 4-House Type Wheel (with Wild neutral)

**Type advantage wheel (content-tunable):**

```
Aether > Cipher > Flux > Forge > Aether
```

- The cycle is a closed 4-way loop: each House beats one and loses to one.
- **Wild is neutral** — Wild-House pets (unknown model IDs, silhouette forms) have no type
  advantage and suffer no type disadvantage. They are fully battle-legal.
- The multipliers applied for type advantage/disadvantage are content-tunable (stored in the
  content pack, not hardcoded in the engine).

### Trait Procs and Behavioral Counters

Traits proc during battle and create behavioral counters:

- **Sprinter counters Marathoner** — burst-style attackers punish endurance builds.
- **Deepdiver counters Swarm** — focused attackers punish high-volume shallow builds.

Additional trait procs apply (exact proc rates are in the backlog: "Battle math: damage formula,
proc rates, House-wheel multipliers"). Trait interaction is part of the battle resolution log and
is visible in the battle replay view (split-pane: HP bars, lunges, screen-shake, floating damage —
pure playback of the resolved log).

### Grade Stat-Floor (~+5%)

A pet's grade provides a **stat-floor bonus** applied before the battle formula:

- **S grade ≈ +5% stat floor.** An S-grade pet's effective stats are floored approximately 5%
  higher than the raw stat values recorded in the hash.
- This is the same bonus referenced in §9 for S-spliced fused pets: receiving S-grade DNA
  confers this floor bonus on the fused result.
- Non-S grades do not receive this floor adjustment. The ~5% figure is the design value;
  exact tuning is in the backlog.

### Archive-Record Battles

Battles against Archive records are supported. A player can challenge their own or a colleague's
best Archive entry by using the stored hash code as one side of the battle. This enables
asynchronous "leaderboard" battles over chat without requiring both players to be present
simultaneously.

### The Four Stats

All pets have four stats with equal total budgets across all final forms (Design Pillar 3,
horizontal evolution):

| Stat   | Abbreviation | House lean (flavor, not absolute — equal total budgets) |
| ------ | ------------ | ------------------------------------------------------- |
| Power  | PWR          | Cipher-line lean                                        |
| Speed  | SPD          | Flux-line lean                                          |
| Wisdom | WIS          | Aether-line lean                                        |
| Grit   | GRT          | Forge-line lean                                         |

Stat distribution flavor per House line comes from content data (tunable). The total stat budget
is always equal across all Apex/fusion forms — different builds, not better builds. Token volume
and model choice never influence stats (Design Pillar 2).

Stat display example from the Archive mockup (species names that correspond to fusion-pool
contents are redacted per the spoiler rule — pool contents are internal, see
`packages/content/content/fusion-pools.json`; the row format and stat values are reproduced
faithfully):

```
#014 Mistral      [A]  PWR 72 SPD 91 WIS 64 GRT 80   gen 6   TTX1-AFAA-21QC-…
#0xx [redacted] ★ [S]  PWR 88 SPD 95 WIS 79 GRT 90   gen 11  TTX1-18F5-PHBE-…
#0xx [redacted]   [B]  PWR 61 SPD 55 WIS 84 GRT 58   gen 4   TTX1-K7Q2-RM9B-…
```

The `★` marker on the S-grade row denotes S-spliced status. The two redacted rows correspond
to fusion-locked special species whose names are held in `fusion-pools.json` only.

---

## Spoiler Notice

The names of individual species within the Vigil, Tempest, Prism, and Chimera fusion pools are
**internal only** and do not appear in this document. Pool contents are internal — see
`packages/content/content/fusion-pools.json`. This page documents pool **types**, their
mechanics, timing tiers, and grade carry rules in full.
