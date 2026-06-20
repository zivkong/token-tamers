# Battles

Battles let you pit the pet you've raised against another — your own past life from your
[Dex records](grades-and-archive.md), or a friend's pet from a [DNA code](grades-and-archive.md)
they pasted you. They are pure spectacle: a battle **never changes your pet, its grade, or
your Dex**. Nothing is at stake but bragging rights, so battle as often as you like.

> Battles are **fully deterministic and offline**. The result is a function of the two
> combatants and the ruleset version — the same two pets always play out the exact same
> fight, frame for frame, on any machine, with no server. Share two codes and a friend can
> replay your battle bit-for-bit.

## The "no model is stronger" guarantee

Battles obey the same pledge as everything else: **no model — and no House — is ever
net-stronger.** The House type wheel is a closed circle, and every advantage is matched by an
equal disadvantage somewhere else on the ring. A pet raised on one agent has no built-in edge
over a pet raised on another; outcomes come from the build you grew (stats, traits, grade) and
the matchup, never from which model fed it.

## How to battle

- **From the shell:** press **`5`** (or click **Battle** in the nav) to open the Battle page — a VS
  setup screen where you pick your fighter (your live pet or any battle-ready Dex record) on the
  left and your opponent on the right: either a pasted DNA code from a friend, or one of your own
  Dex records of a different species. Press **Enter** (or click **Fight**) to start.
- **From the command line:** `tt battle` on a TTY opens the Battle setup screen (same as
  pressing `5` in the shell); `tt battle <CODE>` goes straight to the arena against that DNA code.
  Piped or with `--text`, both print a deterministic text summary instead of the animated view.

In the arena: **Enter** plays / pauses (and rewinds-then-replays once it's over), **←/→** step
through the fight one blow at a time, **r** rematches with a fresh roll (same fighters, different
outcome — variety without fishing), and **Esc** backs out to the setup screen.

> **Readiness gate.** Both sides must have reached the **Evolved** stage to battle. A younger
> pet (or a code for one) shows as _sealed_ until it matures — the same gate that guards DNA
> grafting later. It's always eventually reachable; just keep coding.

> **No fighting your own kind.** You can't battle your pet against your _own_ record of the
> **same species** — a self-mirror match is pointless. Battle a different species from your
> Archive, or a friend's pasted code (another player), which is always allowed even if it's the
> same species. (The same rule will govern DNA grafting.)

## How a fight is decided

Each pet brings its four stats — **PWR / SPD / WIS / GRT** — and its traits. The faster pet
(higher SPD) strikes first; blows trade until one side faints.

### The House type wheel

Each strike is scaled by a House matchup, a closed four-way ring with **Wild neutral**:

```
Aether → Cipher → Flux → Forge → Aether        (Wild: no advantage, no disadvantage)
```

Each House beats exactly one and loses to exactly one; the advantage and its reverse are
reciprocals, so summed around the ring no House comes out ahead. Wild-House pets (unmapped
models) fight on even footing against everyone.

### Trait counters

Some traits punish particular play-styles when they meet in battle — for example **Sprinter**
counters **Marathoner**, and **Deepdiver** counters **Swarm**. When your attacker holds a
counter to the defender's trait, that blow lands harder. (The full counter table is content
data and may be tuned between Seasons.)

### Grade

A pet's [grade](grades-and-archive.md#the-grade-roll-transparent-by-design) gives a small, capped **stat-floor** in battle — an
**S**-grade pet fights at about +5% effective stats. This is battle-only: it never adds to the
pet's recorded, equal-budget stats (horizontal evolution holds — different builds, never better
builds), and it's based on grade, never on the model.

### Feats

Battles earn **Feats** — the same achievement system as the rest of the game. Wins, win
streaks, and total fights played each have their own Feat. Your battle record (played / won /
best streak) is tracked across every session and is the only thing that changes; the pet's
stats, grade, and Dex records are untouched.

## Replays & versions

Because a battle is `f(pet A, pet B, ruleset version)`, holding both DNA codes is enough to
re-watch any fight forever — no replay file needed. When two codes meet, they fight under the
oldest ruleset version both clients understand, so a battle stays reproducible even across
app updates.

> DNA **grafting and fusion** — _applying_ a code to crossbreed pets — is a later Season.
> Today a code you receive can be battled and inspected, but not yet spliced into your line.
