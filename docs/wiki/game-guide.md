# Game Guide

## The canonical cycle rule

- **Egg fast-hatch (the one exception).** ~10 minutes after your first usage of the
  week, the egg hatches into a Sprite — this is the only molt that doesn't wait
  for a 5-h window close. Every later molt obeys the 5-h cycle.
- **Molt = the 5-hour session window close.** The moment a pet can change stage,
  roll a trait, mutate, evolve, or attempt a grade-up.
- **Rebirth = the week boundary.** Ascension, Archive record, inheritance roll, new
  egg. Rebirth never evolves the pet — its final form is whatever it became at the
  week's last molt.

## Stages

Egg (Mote) → Sprite → Rookie → Evolved → Prime → Apex. The egg fast-hatches
~10 min after your first usage of the week. The first true molt commits the Mote to a
House by the window's dominant model-ID gene.

## Houses (identity & cosmetics only — equal stat budgets)

| House  | Diet (model-ID family) | Theme            | Stat lean |
| ------ | ---------------------- | ---------------- | --------- |
| Aether | `claude-*`             | ethereal / mind  | WIS       |
| Cipher | `gpt-*` / `o*`         | glyph / geometry | PWR       |
| Flux   | `gemini-*`             | light / current  | SPD       |
| Forge  | open-weight families   | metal / ember    | GRT       |
| Wild   | anything unmatched     | "???" silhouette | neutral   |

No House is stronger; no model is better food. "Lean" redistributes an equal budget.

## The vitals panel: Food, Diet, Odds

The pet's four **stats** (PWR / SPD / WIS / GRT — a fixed equal budget, _who it is_) sit up by
its name in the identity header. Below the pet are three more readouts — the _living_ ones. None
of them ask anything of you; they just show what your real usage is doing to the pet, reading
top-to-bottom as **now → life → next**:

```
 Food   ▕█████▒▒▒▒▒▒▒▏  84.2M / 200M   +6% molt ↑
 Diet   ▕███████▒▒▒▒▒▏  Aether 72% · Cipher 28%
 Odds   B → A 18%                       rolls at next molt
```

The Food and Diet bars are the **same width** at every terminal size, so they line up — but
they move in opposite ways, which is the whole point.

**Food — how much you're feeding it _now_.** A bar that fills with the tokens used in the
current 5-hour session window toward a **200M "full"** mark, then **resets** when the window
closes. The fuller it gets, the bigger that molt's grade-roll **bonus**, shown live as
`+N% molt`, up to a cap — then it stops mattering. So a last push of real work before a
window closes sweetens the roll. It's a small, **capped** bonus on top of your
baseline-judged odds; model choice never changes it (see [Grades](grades-and-archive.md)).

**Diet — what you've fed it over its _life_.** An **always-full** bar split into colored
House shares (e.g. `Aether 72% · Cipher 28%`), with the percentages beside it. Unlike Food
it never empties — its proportions simply drift as your model mix accumulates across molts.
This is **identity only**: it tints the pet and steers which species line it grows into, and
**never** touches stats, grades, or speed. (Houses, not raw model names — see the table
above.)

**Odds — your _next_ grade roll.** The single live chance for the **current → next** grade,
the only jump that can fire at the next molt, e.g. `B → A 18%`. The grade letters are colored
by the grade ladder (C grey · B green · A violet · S gold). The number moves with your
activity _and_ your Food bonus, so you always see the exact odds before they roll — no hidden
math, no pity. Once a pet reaches the top it reads `S ★ apex — no further rolls`.

## Traits (rolled once per molt, up to ~5 slots)

Marathoner · Sprinter · Polyglot · Nightshade · Daybreaker · Switcher · Deepdiver ·
Swarm · Polyhost — all triggered by _work patterns_, never by model choice or volume.

## Pattern evolutions (locked at the week's final molt)

Marathoner+Nightshade → **Vigil** · Sprinter+Swarm → **Tempest** · any 4 distinct
traits → **Prism** · Polyhost+Switcher → **Chimera**.

## Dormancy

A week of zero usage sends the pet into a cocoon — not death. It wakes when you
return, and surviving Dormancy is itself an achievement.
