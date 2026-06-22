# Battle Playback Redesign — the "Active Battle" page

> **Status:** IMPLEMENTED (Season 0, TUI) — including the polish pass. The arena playback was
> rebuilt as a phased "beat" animation. Pure _presentation_ rework — no engine change (the battle
> timeline already carries everything), so it stays golden-frame testable and replay-deterministic
> (the sim runs once, in the shell). Code: the beat clock + animation math in
> `packages/tui/src/pages/battle-beat.ts`, the renderer in `battle-arena.ts`, the end-of-fight
> flourish + `l` log overlay in `battle-flourish.ts`, and `battle.ts` slimmed to dispatch + picker +
> key controls. Tests: `__tests__/battle-beat.test.ts` (per-effect + outcome unit coverage),
> `battle-setup.test.ts` (the `l`/Esc keys), and golden frames (start / mid-beat / winner flourish /
> Tamer corners / log overlay).
>
> **What shipped vs. this spec.** Landed: the beat clock (slower default, `s` speed cycle 1×/2×/
> 0.5×, turn-break breath), HP tween, held action banner with a universal wind-up lead, attacker
> spotlight / defender dim, lunge + flinch + crit/faint screen-shake, per-effect distinctions
> (crit gold + deeper lunge, dodge "miss" + side-step + no damage, parry steel + chip, proc trait
> banner, faint), the floating impact tag, a demoted log tail, and the footer speed/round readout.
> The polish pass added: **`flipX` facing** (the fighters meet at the center, the opponent sprite
> mirrored), **Tamer handles in the top corners** (`VELA ◆ … ◆ DRIFTER`, diamonds pointing inward),
> the **win flourish** (winner sprite bobs + gold name, loser sprite desaturated + slumped, a
> centered `★ NAME WINS ★` with the winner's Tamer-creature subtitle), and the **`l` log overlay**
> (a full-transcript panel; Esc closes it before leaving the arena).
> **Adapted (TUI-pragmatic):** the floating damage tag holds + fades on a dedicated impact row
> rather than rising (the combatant block is too tight to rise without hitting the HP bar — §6a);
> the loser "topple" is a 1-row slump + palette desaturation rather than a rotation (no glyph
> rotation in a cell grid). Nothing from the proposal remains deferred.

---

## 1. The problem (grounded in the current code)

A player reported the active battle is **too fast and confusing — you can't tell which side is
attacking.** Both complaints trace to two facts in `battle.ts` today:

1. **Pacing.** `advanceBattlePlayback` steps the cursor **one timeline event every
   `BATTLE_STEP_FRAMES = 6` frames** — ~5 events/sec at 30 fps. A turn can fire several events
   back-to-back (a hit, a double-strike `proc`, a `faint`), so three things can flash past in
   ~0.4 s. HP doesn't drain — `hpAt()` just **snaps** to `hpAfter`. There is no beat to read.
2. **No spatial signal.** The arena is **static**. Sprites never move, flinch, or get
   highlighted. The _only_ indication of who hit whom is a single line in a **fast-scrolling
   text Log** (`drawLog`). The eye has to read text faster than it scrolls — exactly the
   "confusing" feeling.

The fix is not "add more text." It's to make the **arena itself perform the fight**, the way a
classic turn-based creature-battler does: two fighters facing each other, the attacker lunges,
the defender flinches, a damage number pops, the HP bar drains, and a single calm **action
banner** narrates the blow — held long enough to read, with a breath between turns.

---

## 2. What data we already have (no engine work)

Every `BattleEvent` in `result.timeline` carries:

| Field                                                   | Use in the redesign                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `actor` (`'a'` \| `'b'`)                                | **Who is attacking** → which side lunges + gets the spotlight + names the banner |
| `kind` (`attack`/`crit`/`parry`/`dodge`/`proc`/`faint`) | The beat's flavor → banner verb, color, shake, dodge-shimmer                     |
| `damage`                                                | The floating damage number                                                       |
| `hpAfter`                                               | The target value the HP bar **tweens toward** (instead of snapping)              |
| `proc` (TraitId)                                        | Names the move on a trait proc ("Sprinter!")                                     |

Plus identity already on each `Combatant`: `name`, `grade` (+ `GRADE_ACCENT`/`GRADE_BADGE`),
`house` (+ `houseColor`), `stats`, `traits`, and **`owner`/`ownerTitle`** — the originating
**Tamer**. The player's own handle is in `ctx.info.tamer` / `ctx.info.tamerTitle`. We already
surface this DIM in a corner via `ownerLabel()`; the redesign promotes it.

So: **the redesign is 100% a `battle.ts` render + a richer playback clock.** The engine,
`types.ts`, and `simulateBattle` are untouched.

---

## 3. North star — the "duel beat"

Replace the per-event 6-frame snap with a **beat**: a short, phased animation for each timeline
event, driven by the existing `frame` counter so it stays pure and deterministic.

```
BEAT  (default ~30f ≈ 1.0s at 30fps; speed-adjustable)
 ┌─ WIND-UP ─┬─ IMPACT ─┬──── DRAIN ────┬─ SETTLE ─┐
 0          6          10               22         30
 │ attacker  │ flash on │ HP bar tweens │ attacker │
 │ slides    │ defender,│ prev→hpAfter, │ slides   │
 │ toward    │ dmg pops,│ number ticks  │ back,    │
 │ foe;      │ shake on │ down, dmg     │ banner   │
 │ spotlight │ crit/    │ number floats │ holds    │
 │ + banner  │ faint    │ up & fades    │          │
 └───────────┴──────────┴───────────────┴──────────┘
 ＋ TURN BREAK: when the next event begins a new `turn`, insert a ~10f pause
   (no motion, banner clears to "Round N") so the eye resets between exchanges.
```

This single change fixes **both** complaints: the default is ~2–3× slower, turns are visually
separated by a breath, and the _motion itself_ (lunge + flinch + directional damage pop) tells
you who is attacking before you read a word.

### Playback clock

Today: `cursor` (event index), advanced 1 per 6 frames. Proposed: keep `cursor` as the
**event being animated**, add `beatFrame` (frames elapsed in the current beat) and a
`speed` multiplier. `advanceBattlePlayback` becomes:

```
beatFrame += 1
if beatFrame >= beatLen(event, speed):   // beatLen longer for crit/faint, +gap on turn change
    cursor += 1; beatFrame = 0
    if cursor >= timeline.length: playing = false
```

`beatFrame / beatLen` is the eased `t` the renderer uses to interpolate sprite offset, HP
fill, and damage-number rise. All pure functions of `(cursor, beatFrame)` → golden-frame safe
(a frame with `beatFrame` fixed renders identically forever).

---

## 4. The new arena layout

Full-canvas, two fighters **facing each other** (opponent sprite mirrored — see §7). Tamer
names ride the **top corners**; fighter identity sits under each; HP bars below that; the
creatures face off in the middle band; floating damage rises off the struck side; and **one
calm action banner** spans the bottom of the arena above the footer.

```
┌───────────────────────── ROUND 3 ─────────────────────────┐
│ VELA ◆                                          ◆ DRIFTER  │  ← Tamer handles (corners)
│ Aether Drake ★A                            Cipher Maul ●B  │  ← name + grade badge
│ ███████████████░░░░░  78/120        44/110  █████████░░░░░ │  ← HP bars (tween, mirrored fill)
│ ● Aether House                            Cipher House ●   │
│                                                            │
│                                              -18           │  ← floating damage (rises, fades)
│            (>'')>  »»»            ⟪ flinch ⟫ <(@_@)         │  ← attacker lunges ▸, foe recoils ◂
│         ▔▔▔▔▔▔▔▔                                           │  ← spotlight underglow on attacker
│                                                            │
├────────────────────────────────────────────────────────────┤
│  ▶  Aether Drake strikes Cipher Maul for 18!               │  ← ACTION BANNER (held, readable)
└────────────────────────────────────────────────────────────┘
   Enter ❚❚ pause   r rematch   s speed 1×   ←→ step   Esc back   [12/41]
```

The split is still ~mid-canvas, but the two halves now **read as one stage** because the
creatures point at each other and the action happens _between_ them, not in two separate text
columns.

---

## 5. "Who is attacking?" — four redundant, glanceable cues

The whole point. The attacker is signalled **four ways at once**, so it's unmistakable even at
a glance and even in `--no-color`:

1. **Lunge.** During WIND-UP→IMPACT the attacker's sprite slides a few sub-cells **toward** the
   foe (eased), then slides back in SETTLE. Motion = "this one is acting."
2. **Flinch / recoil.** The defender jitters 1 cell away on IMPACT (and a deeper shove on crit).
3. **Spotlight.** The attacker's name + an underglow bar (`▔▔▔`) brighten to full; the
   defender's panel dims ~30%. Pure value contrast, survives color degradation.
4. **Directional banner + damage.** The banner always reads **`ATTACKER … DEFENDER`** (subject
   first), and the floating `-18` rises off the **struck** side. The arrow glyphs (`»»»` from the
   attacker, recoil mark on the foe) point the direction of the blow.

No single cue carries the load — if a terminal can't shake or mirror, the spotlight + banner
still make it obvious.

---

## 6. Beat-by-beat mockups (one exchange)

**WIND-UP** (`t≈0.2`) — left winds up, banner announces, foe still:

```
│ Aether Drake ★A  «spotlit»                 Cipher Maul ●B «dim» │
│            (>'')>  »                          <(@_@)            │
│         ▔▔▔▔▔▔▔▔                                                │
├────────────────────────────────────────────────────────────────┤
│  ▶  Aether Drake winds up…                                      │
```

**IMPACT** (`t≈0.35`) — lunge connects, damage pops, foe flinches:

```
│            (>'')>  »»»》            -18      ⟪!⟫ <(@_@)         │
├────────────────────────────────────────────────────────────────┤
│  ▶  Aether Drake strikes Cipher Maul for 18!                   │
```

**DRAIN** (`t≈0.7`) — HP bar empties toward `hpAfter`, number ticks 62→44, `-18` floats up:

```
│ Aether Drake ★A                            Cipher Maul ●B      │
│ ███████████████░░░░░  78/120        44/110  █████████░░░░░     │
│                                          ⁻¹⁸                    │  (damage number rising/fading)
│            (>'')>                            <(@_@)             │
├────────────────────────────────────────────────────────────────┤
│  ▶  Aether Drake strikes Cipher Maul for 18!                   │
```

**TURN BREAK** — before side B answers, a held breath:

```
├────────────────────────────────────────────────────────────────┤
│  ——  Round 4  ——                                               │
```

### 6a. Per-effect animation spec

Each `kind` gets its **own choreography** — distinct motion, glyph, color and timing — so the
player learns to read the fight by _shape of motion_, not by reading the banner. Every effect is
a closed-form function of `beatFrame/beatLen`, so it's golden-frame pure and replays identically.

The shared vocabulary the effects compose from:

- **lunge(t)** — attacker sprite x-offset toward foe, eased out then back (peaks at IMPACT).
- **flinch(t)** — defender x-offset _away_ + 1-frame brightness blowout on IMPACT.
- **shake(n)** — whole-arena x-jitter for `n` frames (crit/faint); deterministic ±1/±2 pattern.
- **pop(text, t)** — floating string rising off a side, fading on the color ramp (damage, tags).
- **glint(side, t)** — a 2–3 frame bright frame overlay on a sprite (guard flash, dodge shimmer).
- **spotlight / dim** — attacker panel full brightness, defender ~30% dim (always on, all beats).

| `kind`                   | beatLen | Motion choreography                                                                                                             | Floating text / glyph                                    | Color & shake                                  | Banner (subject-first)                                   |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| **attack**               | 1.0×    | attacker `lunge`, defender `flinch` on contact                                                                                  | `-18` pops over defender, rises & fades                  | normal damage color, no shake                  | `▶ Aether Drake strikes Cipher Maul for 18!`             |
| **crit**                 | 1.5×    | deeper `lunge` (overshoot), defender `flinch` + knockback                                                                       | `‑33` **larger, gold**, rises slower                     | gold IMPACT flash + **`shake(4)` double-jolt** | `✸ CRITICAL!  Aether Drake CRITS for 33!`                |
| **parry**                | 1.1×    | attacker `lunge` connects but **stops short**; defender holds ground, `glint` (guard)                                           | `⛊` guard spark on defender, then a small reduced `-7`   | defender-GRT tint flash, no shake              | `⛊ Cipher Maul parries — turns it aside, takes 7.`       |
| **dodge**                | 0.8×    | attacker `lunge` **whiffs past** (slides through empty space); defender **side-steps** (quick 2-cell hop + `glint` after-image) | `↯ DODGE` tag pops where the foe _was_; no damage number | cool/SPD tint shimmer, no shake                | `↯ Cipher Maul slips the blow!`                          |
| **proc (double-strike)** | 1.4×    | attacker lunges **twice** in one beat (lunge → quick retract → lunge again); defender flinches on each                          | two damage pops (`-18` `-15`) staggered                  | trait-accent flash on the attacker name        | `⚡ Sprinter!  Aether Drake double-strikes for 18 + 15!` |
| **proc (counter)**       | 1.2×    | defender pre-empts: a brief **counter-lunge** back at the attacker on contact                                                   | counter glyph `⤺` between them                           | trait-accent flash on the defender             | `⚡ Deepdiver!  Cipher Maul counters Aether Drake.`      |
| **faint**                | 1.6×    | the downed sprite **topples** — drop + 90° lean (`x_x`) + grey-out fade over the beat                                           | —                                                        | slow desaturation, soft `shake(2)` on the drop | `✖ Cipher Maul faints.` → win flourish (§8)              |

Notes:

- **`proc` covers two shapes.** The timeline only tells us `kind:'proc'` + the `proc` TraitId, not
  whether it was the offensive double-strike or a defensive counter. We map by trait family
  (Sprinter/Swarm-style → double-strike choreography; Deepdiver/counter-style → counter
  choreography) from a small content-side lookup — _cosmetic only_, never touches the sim. Unknown
  procs fall back to the **attack** choreography with the trait name in the banner, so a future
  trait still animates legibly (dormant-gene rule).
- **Double-strike** in the engine is literally a second event the same `turn`; we have a choice —
  either play the two events as two normal beats (cheap, already works) **or** fuse them into the
  single double-lunge beat above when they share `turn` + `actor`. The fused version reads far
  better; detection is a one-line "peek at next event" in the beat clock.
- **Stacking is fine.** A crit that also faints = crit choreography, then the topple inherits the
  gold flash. The beat clock just runs them in sequence with their own `beatLen`s.

### Effect mockups

**Dodge** (`t≈0.4`) — the attack whiffs, foe has hopped aside, after-image where it stood:

```
│            (>'')>  »»»·····             ·°· <(@_@)             │   (foe side-stepped → )
│                                    ↯ DODGE                      │
├────────────────────────────────────────────────────────────────┤
│  ↯  Cipher Maul slips the blow!                                │
```

**Parry** (`t≈0.35`) — lunge stopped short by a guard glint, small chip damage:

```
│            (>'')>  »»⛊                       <(•‸•)>           │   (guard up)
│                                          -7                     │
├────────────────────────────────────────────────────────────────┤
│  ⛊  Cipher Maul parries — turns it aside, takes 7.            │
```

**Crit** (`t≈0.35`, arena jolting) — overshoot lunge, gold pop, double-shake:

```
│          (>'')>  »»»》            ‑33      ⟪✸!⟫ <(x_x)         │   «whole frame jitters»
├────────────────────────────────────────────────────────────────┤
│  ✸  CRITICAL!  Aether Drake CRITS Cipher Maul for 33!         │
```

**Double-strike proc** (`t≈0.65`) — second lunge mid-beat, two staggered numbers:

```
│            (>'')>  »» »»》          -18 -15   ⟪!!⟫ <(@_@)      │
├────────────────────────────────────────────────────────────────┤
│  ⚡  Sprinter!  Aether Drake double-strikes for 18 + 15!       │
```

**Faint** (`t≈0.8`) — topple + grey fade, leading into the win flourish:

```
│            (>'')>                            x_x  «greying»     │
│         ▔▔▔▔▔▔▔▔  «winner glows»             ▁▁▁                │
├────────────────────────────────────────────────────────────────┤
│  ✖  Cipher Maul faints.                                        │
```

All effect motion degrades cleanly: with no `flipX`/shake support the **glint, spotlight, the
floating tag (`↯ DODGE` / `-7` / `‑33`) and the banner** still distinguish every effect — the
extra motion is enrichment, never the sole carrier of meaning.

---

## 7. The text Log — keep it, demote it

The scrolling Log is genuinely useful as a _transcript_, but it shouldn't be the primary read.
Proposal: the **action banner is primary** (one held line), and the full Log becomes an
**optional reveal** — a `l`-toggled side/overlay transcript for players who want to scrub the
play-by-play, reusing the existing `logLine()` strings verbatim. On a short dock where the
banner + arena already fill the canvas, the Log simply stays hidden. (Cheapest version: keep a
**2-line "recent" tail** under the banner and drop the rest — no toggle. Start there.)

---

## 8. Win / lose flourish

When `cursor` reaches the end (`done`), replace the quiet `★ Name wins!` line with a real
beat:

```
┌──────────────────────────────────────────────────────────┐
│                                                            │
│        \(^o^)/                         x_x  (toppled)      │
│       ▔▔▔▔▔▔▔  «winner glows, grade-accent»                │
│                                                            │
│            ★  AETHER DRAKE WINS  ★                         │
│              Vela's Aether Drake · gen 6                   │
│                                                            │
├──────────────────────────────────────────────────────────┤
│   Enter replay   ·   r rematch   ·   Esc back              │
```

Winner sprite glows in its grade accent and does a small idle bob; loser is greyed + toppled;
the **Tamer line** ("Vela's Aether Drake") gives the moment ownership. A draw shows both
upright with `⚖ Draw`.

---

## 9. Pacing controls (the direct fix for "too fast")

- **Default beat is slower** (~1.0 s vs the current ~0.2 s/event) **and turns are separated**
  by a break — the core remedy.
- **`s` cycles speed** `0.5× / 1× / 2×` (beat length scales; default `1×`). A player who finds
  it slow speeds up; the complainer slows down. Persist last choice in `SettingsState` if we
  want it sticky (optional).
- **`←→` step** and **`Enter` pause** already exist — they now land on **beat boundaries**, so
  stepping advances one readable exchange, not one micro-event.

---

## 10. Tamer names + breathing room (asked for directly)

- **Tamer handles in the top corners**, full brightness (today they're DIM and buried under the
  House label). Left = `ctx.info.tamer` (you) or the fighter's `owner`; right = the opponent's
  `owner` (from a pasted code's maker's-mark) or your handle for an own-Dex pick. `ownerTitle`
  appended when present: `VELA · Night Warden`.
- **Gaps:** the arena gains vertical breathing room — a clear band between the HP row and the
  creatures, and between the creatures and the banner — instead of the current tight stack.
  On short docks the gaps collapse gracefully (the existing `logGap` short-dock logic
  generalizes to the whole layout).

---

## 11. What this needs from the renderer (small, contained)

Almost everything reuses existing primitives (`drawSprite`, `drawMeter`, `buildPalette`,
`drawDivider`, `clipText`, and the **already-imported `FlashTarget`/`shell-effects`** flash
system). New bits:

1. **`flipX` on `drawSprite`** — mirror a sprite horizontally so the opponent faces left.
   One transform in the compositor's column read; ~a few lines. _Without it_, fall back to the
   current same-facing sprites — the lunge/spotlight/banner cues still work, facing is just less
   pretty. (So `flipX` is a nice-to-have, not a blocker.)
2. **A tiny floating-text helper** — draw a short string at a fractional rising y with fade
   (clamp to color ramp). Damage numbers + "DODGE"/"PARRY" tags. ~20 lines, golden-safe.
3. **Beat clock fields on `BattleView`** — `beatFrame`, `speed` (and reuse `cursor`). Pure
   additions to the view object; `advanceBattlePlayback` and `scrub` operate on beat boundaries.

No new dependency, no engine touch, no new network/IO. Determinism holds: every visual is a
pure function of `(timeline, cursor, beatFrame)`.

---

## 12. Golden-frame & determinism notes

- Frames stay `f(view, frame)`. Golden tests pin specific `(cursor, beatFrame)` values to
  snapshot WIND-UP / IMPACT / DRAIN / TURN-BREAK / WIN states. Because the sim is unchanged and
  the clock is integer-stepped, every snapshot is reproducible.
- No `Date.now`/`Math.random` enters the renderer (the lunge/fade easings are closed-form on
  `beatFrame`). Replays and shared-code battles render identically on every machine.
- `--no-color` path: lunge + flinch + spotlight (value contrast) + banner all survive; damage
  numbers render as plain `-18`. Information never disappears (color-degradation rule).

---

## 13. Suggested phasing (lazy first, full later)

1. **MVP (biggest win, smallest diff):** the **beat clock** (slower default + turn breaks +
   speed key) and the **held action banner** with the subject-first `ATTACKER … DEFENDER`
   wording + the **attacker spotlight/dim**. No new sprite work. This alone fixes "too fast" and
   "which side" using only text + the existing HP bars.
2. **Motion pass:** the shared vocabulary (§6a) — `lunge`/`flinch` offsets, HP-bar tween,
   `pop` floating numbers — wired for the plain **attack** beat first.
3. **Effects pass:** the per-effect choreography (§6a) — dodge side-step, parry guard-glint,
   crit overshoot + `shake`, double-strike fused double-lunge + counter, faint topple. This is
   where the `proc` trait-family lookup (cosmetic, content-side) and the "fuse same-turn
   double-strike" beat-clock peek land.
4. **Polish pass:** `flipX` facing, win/lose flourish, Tamer corners, optional Log toggle.

Each phase ships independently and keeps the page golden-tested.
