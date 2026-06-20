# Game Guide

## The canonical cycle rule

- **Egg fast-hatch (the one exception).** ~10 minutes after your first usage of the
  week, the egg hatches into a Sprite — this is the only molt that doesn't wait
  for a 5-h window close. Every later molt obeys the 5-h cycle.
- **Molt = the 5-hour session window close.** The moment a pet can change stage,
  roll a trait, mutate, evolve, or attempt a grade-up.
- **Rebirth = the week boundary.** Dex record captured, inheritance roll, new
  egg. Rebirth never evolves the pet — its final form is whatever it became at the
  week's last molt.

## Stages

Egg (Mote) → Sprite → Rookie → Evolved → Prime → Apex. The egg fast-hatches
~10 min after your first usage of the week. The first true molt commits the Mote to a
House by the window's dominant model-ID gene.

**Your pet grows over the week, not in an afternoon.** A molt is a _chance_ to evolve, not a
guarantee — each stage takes a little while to **mature** before it moves up, and the later
stages take longer than the early ones. So a sprite finds its feet on day one, but reaching the
final **Apex** form is the reward of a sustained, good week (it also needs your pet to have graded
up at least once — see [Grades](grades-and-archive.md)). All told the climb is paced across
roughly **five active days**, leaving the back half of the week for the form to settle and the
grade to climb. You'll never see an exact "evolves in N molts" countdown — _what_ your pet becomes,
and _when_, is meant to be a surprise. What you _can_ watch is the **Grow** meter below the pet,
which simply fills as it matures (see the vitals panel). Quiet week? Nothing is lost — your pet
just grows more slowly, and a week with no usage at all rests as a [Dormant](#dormancy) cocoon.

## Houses (identity & cosmetics only — equal stat budgets)

| House  | Diet (mixed model families)         | Kingdom (creatures)     | Theme             | Stat lean |
| ------ | ----------------------------------- | ----------------------- | ----------------- | --------- |
| Aether | `claude-*` · `minimax*`             | 🌤 Sky Court (flyers)   | ethereal / mind   | WIS       |
| Cipher | `gpt-*` / `o*` · `glm*` · `mimo*`   | ⛰ Crag Beasts (ground) | glyph / geometry  | PWR       |
| Flux   | `gemini-*` · `qwen*` · `kimi*`      | 🌊 Tide Runners (swift) | light / current   | SPD       |
| Forge  | `llama*` · `mistral*` · `deepseek*` | 🔥 Iron Brood (robots)  | metal / ember     | GRT       |
| Wild   | anything unmapped                   | 🌱 The Bloom (plants)   | feral / overgrown | neutral   |

Each House blends models from several makers, grouped by _vibe_, not brand — no House
is all-Western or all-anything. Each is also a **Creature Kingdom** that gives its pets a real
animal body (flyers, ground beasts, swift swimmers, robots, plants) — looks only. No House is
stronger; no model is better food. "Lean" redistributes an equal budget. (Full list + glob
patterns + kingdoms: [Houses](houses.md).)

## The vitals panel: Food, Diet, Grow, Odds

The pet's four **stats** (PWR / SPD / WIS / GRT — a fixed equal budget, _who it is_) sit up by
its name in the identity header. Below the pet are four more readouts — the _living_ ones. None
of them ask anything of you; they just show what your real usage is doing to the pet, reading
top-to-bottom as **now → life → growth → next**:

```
 Food   ▕█████▒▒▒▒▒▒▒▏  84.2M / 200M   +6% molt ↑
 Diet   ▕███████▒▒▒▒▒▏  Aether 72% · Cipher 28%
 Grow   ▕████▒▒▒▒▒▒▒▒▏  Rookie · Molt 4h 59m
 Odds   B → A 18%  · Reborn 6d 23h
```

The Food, Diet and Grow bars are the **same width** at every terminal size, so they line up — but
they move in different ways, which is the whole point.

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

**Grow — how close it is to its _next_ form.** A bar that fills as your pet matures through its
current stage and **resets** each time it evolves. The label beside it names the current stage and
counts down to the next molt — e.g. `Rookie · Molt 4h 59m` — so you always know where you stand
and when the next change can happen. At Apex-S, when there's nothing left to roll, it settles to
`Apex · max grade`. What the bar deliberately doesn't reveal is _what form comes next_ — the branch
your pet takes stays a surprise until it evolves.

**Odds — your _next_ grade roll.** The single live chance for the **current → next** grade,
the only jump that can fire at the next molt, e.g. `B → A 18%`. The grade letters are colored
by the grade ladder (C grey · B green · A violet · S gold). The number moves with your
activity _and_ your Food bonus, so you always see the exact odds before they roll — no hidden
math, no pity. Beside the odds, a muted `· Reborn 6d 23h` deadline counts down to the automatic
weekly rebirth. Once at S grade it reads `S ★ apex — no further rolls`.

At **Apex** stage the rebirth deadline becomes a clickable **`[ Reborn Now · … ]`** button — press
it (or click) to force an early rebirth before the week is up. A confirm modal opens first; if your
pet hasn't reached S yet, it clearly warns you the grade can still roll higher.

## Traits (rolled once per molt, up to ~5 slots)

Marathoner · Sprinter · Polyglot · Nightshade · Daybreaker · Switcher · Deepdiver ·
Swarm · Polyhost — all triggered by _work patterns_, never by model choice or volume.

## Pattern evolutions (locked at the week's final molt)

Marathoner+Nightshade → **Vigil** · Sprinter+Swarm → **Tempest** · any 4 distinct
traits → **Prism** · Polyhost+Switcher → **Chimera**.

## Dormancy

A week of zero usage sends the pet into a cocoon — not death. It wakes when you
return, and surviving Dormancy is itself an achievement.

## The shell at a glance

The interactive shell (`tt` with no args) has six pages, selectable by the hotkeys in the bottom menu bar:

| Key | Page     | What you'll find                                                              |
| --- | -------- | ----------------------------------------------------------------------------- |
| `1` | Pet      | Your live pet, stats, and the four-row vitals panel                           |
| `2` | Dex      | Your per-House species constellation + detail records                         |
| `3` | Loot     | Habitats and trinkets — browse and equip your collection                      |
| `4` | Feats    | Achievements — earned ones shown, locked ones masked `???` with a how-to hint |
| `5` | Battle   | Pick a fighter and challenge a DNA code or your own Dex                       |
| `6` | Settings | Cycle mode, color, sub-cell density                                           |

Press `q` or `Ctrl-C` to quit.
