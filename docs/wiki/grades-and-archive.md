# Grades & the Archive

## The grade roll (transparent by design)

Every pet hatches at **C** ~10 minutes after the week's first usage. At every molt
it rolls a grade-up chance, one step at a time, and the grade **never goes down** —
not from a bad week, not from Dormancy.

| Roll  | Base chance | With activity modifier (×0.5 – ×2.0) |
| ----- | ----------- | ------------------------------------ |
| C → B | 25%         | 12.5% – 50%                          |
| B → A | 10%         | 5% – 20%                             |
| A → S | 3%          | 1.5% – **6% (hard cap)**             |

The activity modifier comes from the same model-neutral molt signals (consistency vs
your own baseline, rhythm quality, trait synergy, diversity) — **token volume and model
choice never change it**.

On top of that, a small **Food bonus** rewards a heavy session: the more tokens you use
before the window closes, the more it adds to that molt's roll — up to **+15 points at
200M tokens**, then it stops climbing. It's the one place raw volume helps; it can never
dominate your baseline-judged odds, the A→S 6% cap still holds after it, and model choice
still never matters. The pet screen's **Food** meter shows it filling live (see the
[Game Guide](game-guide.md#the-vitals-panel-food-diet-grow-odds)).

There is no pity guarantee — every roll can fail. The pet screen's **Odds** row shows the
exact live chance for your current → next grade (e.g. `B → A 18%`), grade-colored and updated
as your activity and Food move it — so the number you see is the number that rolls. At the
top it reads `S ★ apex — no further rolls`.

Your grade also unlocks the **final evolution**: a Prime won't ascend to its **Apex** form until
it has reached at least **grade B** (alongside maturing through the stage). It's the one place
grade and evolution meet — Apex is the mark of a sustained, good week, not a default. Everything
else about evolution stays separate from grade.

A successful roll is a **Gradeshift**: the pet's palette visibly upgrades live.

## The Dex — your record book

The **Dex** is the detailed record of every species you've raised. Each species keeps its
**best 3 lives** (ranked by grade, then total stats), captured as your pet grows — at each
molt, every evolution, and at rebirth. So if a Murmur was a **C** the first time and an **A**
the next, the Dex automatically keeps the **A** (and the C as a runner-up) — you never lose
your best.

Each row in the Dex list is colored by that species' **highest grade** (★ S gold · ◆ A violet
· ● B green · ○ C grey), with its House dot for identity. **Click a discovered species** (or
press Enter) to open its detail page: a big portrait tinted to its best grade, its readiness
banner, and up to three record cards — each showing the stats, the date, a shareable **DNA
code**, and the record's graft strength. Press **Esc** to go back.

### DNA codes

Every record carries a **DNA code** — a copyable, license-key-style token like
`TTX1-AFAA-21QC-V22T-E5V9-…` that captures that life (species, House, grade, stats, traits, and
more). The same pet always produces the same code, and codes are designed to stay valid
**forever**: a code you share today still reads on any future version. Trading battles and DNA
grafting (fusing a friend's DNA into your pet) are coming in a later update; for now the code
is yours to keep and share.

### Battle- & graft-ready

A record only becomes **battle-ready and graft-ready** once that life reached the **Evolved**
stage — about halfway up the growth climb. Younger records still show their DNA code, but it's
**sealed** until they've matured enough, so battles and DNA grafting can't be farmed from fresh
hatchlings. When grafting arrives, a stronger donor grade will nudge the result a little more
(an **S** gives the biggest, but still gently capped, boost; a **C** gives nothing).

## The Archive

The **Archive** is the hall-of-fame view of your Dex — your single best life per species (final
grade + final stats), drawn straight from your Dex records. Run `tt archive`, or open the
Archive page in the shell.

```
 ◆ TOKEN TAMERS ARCHIVE — 12/56 unlocked · Season 0 ◆
 #001 Wisp        [B]  PWR 40 SPD 38 WIS 61 GRT 41   gen 2
 #061 ???         [—]  a later Season's gene — update to awaken
```
