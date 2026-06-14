# Species

Your pet is one creature with one life, but it travels a **branching lineage** as it
grows — and which form it becomes is meant to be a surprise. This page documents the
_shape_ of that journey: how many forms exist, how the branches fork, and where the
Dex fills in. It deliberately leaves the **names blank** — those are yours to discover.

> **Why the `???`s?** Token Tamers is a completionist game, and the joy is watching a
> form you've never seen resolve out of a silhouette. The in-game **Dex** shows each
> species as `???` until _you_ raise it. This page mirrors that: it tells you the rules,
> not the answers. (Curious where the surprise ends? Datamining the content pack is
> always possible — but the official docs never spoil.)

## The stage track

Every lineage climbs the same five-step ladder, from a shared egg up to a House-specific
peak:

```
Egg (Mote) → Sprite → Rookie → Evolved → Prime → Apex
```

- **Egg — the Mote.** The one form every pet shares: a softly glowing orb whose House
  is "not yet determined." It fast-hatches ~10 minutes after your first usage of the
  week (see the [Game Guide](game-guide.md)).
- **Sprite → Apex.** Each later molt is a _chance_ to evolve, paced so the whole climb
  spans roughly **five active days**. The final step into **Apex** also needs your pet
  to have reached **grade ≥ B** — Apex is an earned good week, not a default. (Apex is
  the stage; the grade is separate — an Apex pet can be B, A, or _S_. See
  [Grades & the Archive](grades-and-archive.md).)

You'll never see an "evolves in N molts" countdown — only the abstract **Grow** bar,
which fills as your pet matures and resets when it evolves.

## The lineage shape (per House line)

Each shipped House grows along an identically-shaped tree — different art and flavor,
but the same branching budget, because **no House is stronger than another**:

```
                              (1) Sprite
                                  │
                    ┌─────────────┴─────────────┐
                (2) Rookie ???              Rookie ???      ← branch by RHYTHM
                    └─────────────┬─────────────┘
              ┌───────────────────┼───────────────────┐
        (3) Evolved ???     Evolved ???     Evolved ???    ← branch by TRAIT CLASS
              └───────────────────┼───────────────────┘
              ┌───────────────────┼───────────────────┐
        (3) Prime ???       Prime ???       Prime ???      ← branch by CONSISTENCY
              └───────────────────┬───────────────────┘
                    ┌─────────────┴─────────────┐
              (2) Apex ???                  Apex ???        ← branch by lifetime ARC
```

So a single House line holds **11 forms**: 1 sprite, 2 rookies, 3 evolved, 3 primes,
and **2 legendary Apex forms**. With the shared Mote egg, the two M1 lines total
**23 shipped species**.

**What steers each fork** (all from _work patterns_, never model choice or volume):

| Fork             | Decided by                                                         |
| ---------------- | ------------------------------------------------------------------ |
| Sprite → Rookie  | your **rhythm** — steady vs bursty work                            |
| Rookie → Evolved | your dominant **trait class** — endurance / tempo / breadth        |
| Evolved → Prime  | **consistency** against your own baseline                          |
| Prime → Apex     | your lifetime **arc** — early-peaking vs late-blooming (gated ≥ B) |

## The shipped lines

| House line | Diet (model-ID family) | Forms | Status       |
| ---------- | ---------------------- | ----- | ------------ |
| **Aether** | `claude-*`             | 11    | Shipped (M1) |
| **Cipher** | `gpt-*` · `o*`         | 11    | Shipped (M1) |
| **Flux**   | `gemini-*`             | 11    | Lines in M2  |
| **Forge**  | open-weight families   | 11    | Lines in M2  |

See [Houses](houses.md) for how your model usage picks which line you grow.

## Pattern overlays — the special forms

On top of the base form, a pet that earns the right combination of **traits** locks a
**pattern overlay** at the week's final molt — a named variant with its own palette and
aura:

- **Vigil** — Marathoner + Nightshade
- **Tempest** — Sprinter + Swarm
- **Prism** — any 4 distinct traits
- **Chimera** — Polyhost + Switcher

(These pattern _names_ are public; the specific overlay forms stay part of the
discovery. See the [Game Guide](game-guide.md#pattern-evolutions-locked-at-the-weeks-final-molt).)

## Fusion specials — locked, hinted, never spoiled

Beyond the shipped lines, later milestones add **fusion-locked specials**: rare forms
reachable only by applying **DNA codes** from cross-provider, multi-agent work. Their
contents — names, sprites, stats — are deliberately kept out of every official page.
What's public is only that they exist, the DNA _types_, and a riddle:

> _Vigil DNA — "those who watch through the night are watched back…"_

The rest is for the community to uncover. The Dex keeps a `???` slot waiting.

## Dormant genes

A species your build doesn't yet recognize shows in the Dex as a `???` silhouette — a
**dormant gene**, not an error. Registries are additive-only, so an [update](getting-started.md)
or future content pack awakens it without ever invalidating an old record.

## See also

- [Houses](houses.md) · [Game Guide](game-guide.md) · [Grades & the Archive](grades-and-archive.md)
- [Achievements](achievements.md) — the completionist checklist that tracks your Dex
