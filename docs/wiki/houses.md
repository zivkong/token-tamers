# Houses

A **House** is your pet's identity — its theme, palette, and which species line it
grows along. Your House is decided by the **model-ID family** you code with: whatever
agent and model you already use picks the House for you. That's the _only_ thing the
model choice does.

A House is an **aesthetic family, not a brand**. Each one deliberately blends models
from several makers — Western and otherwise — so no House is "the Claude house" or "the
Chinese-models house." Models are grouped by _vibe_ (mind, geometry, light, metal), and
which one you use just colors your pet's identity. It never changes power.

> **No model judgment.** A House is cosmetics and identity, never power. Every House
> shares the **same stat budget** — no House is stronger, no model is "better food,"
> and your grades are judged against your own baseline, never your model. Houses are
> also the _only_ public vocabulary for provider identity: in battles and on shared
> DNA codes, the House shows, the provider name never does.

## The five Houses

Each House is also a **Creature Kingdom** — its pets are a distinct kind of animal you can
recognize from silhouette alone. That's pure looks: the kingdom never changes power, only the
shape your pet wears.

| House      | Diet (model families)¹           | Kingdom (creatures)     | Theme             | Stat lean | Status       |
| ---------- | -------------------------------- | ----------------------- | ----------------- | --------- | ------------ |
| **Aether** | `claude-*` · MiniMax             | 🌤 Sky Court (flyers)   | ethereal / mind   | WIS       | Shipped (M1) |
| **Cipher** | `gpt-*`/`o*` · GLM · MiMo        | ⛰ Crag Beasts (ground) | glyph / geometry  | PWR       | Shipped (M1) |
| **Flux**   | `gemini-*` · Qwen · Kimi         | 🌊 Tide Runners (swift) | light / current   | SPD       | Shipped      |
| **Forge**  | `llama*` · `mistral*` · DeepSeek | 🔥 Iron Brood (robots)  | metal / ember     | GRT       | Shipped      |
| **Wild**   | anything unmapped                | 🌱 The Bloom (plants)   | feral / overgrown | neutral   | Shipped      |

**The Kingdoms.** Aether's **Sky Court** are winged sky-creatures that never touch the ground —
floating moth-sages and sky-mantas trailing veils of light. Cipher's **Crag Beasts** are heavy
ground predators in faceted, glyph-etched armor. Flux's **Tide Runners** are streamlined,
fast-darting creatures of current and fin. Forge's **Iron Brood** are riveted constructs with
glowing ember-vents. Wild's **The Bloom** are feral plant-beasts — and the home of every
not-yet-recognized model, waiting to sprout. A creature keeps its kingdom's look — and its own
signature feature — as it grows, so an Apex still reads as the grown-up of the hatchling you
started with.

¹ The glob patterns behind each: Aether `minimax*`/`abab*`; Cipher `glm*`/`codegeex*`,
`mimo*`; Flux `qwen*`/`qwq*`/`qvq*`, `kimi*`/`moonshot*`; Forge `deepseek*`. Matching is
**case-insensitive**, so a CamelCase slug like `MiniMax-Text-01` lands in Aether all the
same. Only popular families are mapped today — anything else (e.g. `phi*`, `gemma*`,
`yi-*`) rests in **Wild** until a future pack adopts it.

**All five lines are live.** Aether, Cipher, Flux, Forge, and Wild each have their full
11-form creature line now — code into any of them and your pet grows along its own kingdom.
Wild's **Bloom** doubles as the home for any model the game doesn't recognize yet (see below) —
so there's no blank silhouette anymore; an unmapped model simply grows a feral plant-beast.

**About "stat lean."** Every pet gets the same fixed stat budget across PWR / SPD /
WIS / GRT — the lean only changes how that one budget is _distributed_. An Aether pet
leans into WIS; a Cipher pet leans into PWR; the totals match. It's flavor, not
advantage (see [Grades & the Archive](grades-and-archive.md) for what actually moves a
pet's quality).

## How your House is chosen — the Diet

Your pet doesn't pick a House once and freeze. It eats your real model usage over its
life, and the running mix is the **Diet** bar on the pet screen (an always-full bar
split into colored House shares, e.g. `Aether 72% · Cipher 28%`). The Diet:

- **commits the egg to a House** at its first true molt, by the window's dominant gene;
- **tints the pet** and **steers which species line it grows into** as the mix drifts;
- **never** touches stats, grades, or speed — it is identity only.

Code mostly with `claude-*` or MiniMax and your pet lives an Aether life; lean into
`gpt-*`/`o*`, GLM, or MiMo and Cipher's geometry takes over. Because each House blends
several makers, your everyday model mix — not its brand — is what settles your pet's
identity. Mix across Houses and the Diet blends, which is exactly how the hybrid lines
and fusion specials of later milestones come into reach.

## Wild — The Bloom (the feral house)

**Wild** is the House for anything Token Tamers doesn't yet recognize — and it's a real,
playable line now: **The Bloom**, a kingdom of feral plant-beasts with a neutral (balanced)
stat budget. Code mostly with a model the game hasn't mapped (e.g. `phi*`, `gemma*`, `yi-*`)
and your pet grows a Bloom — a Sprout that climbs to a towering grove-spirit, same 11-form
track as every other house.

It keeps its **dormant-gene** nature too: the registry is additive-only, so when a future
content pack (or an [update](getting-started.md)) teaches the game that model's family, the
gene "awakens" and that model moves into its newly-recognized House. Nothing is lost — and in
the meantime your unmapped models grow a real creature instead of a blank silhouette.

(Note: a shared DNA hash referencing a _species_ your build doesn't have still shows as a
`???` Dex silhouette until you update — that forward-compatible discovery is unchanged.)

## See also

- [Game Guide](game-guide.md) — the vitals panel, where the Diet bar lives
- [Species](species.md) — the lineage shape each House grows along
- [Grades & the Archive](grades-and-archive.md) — what actually determines pet quality
