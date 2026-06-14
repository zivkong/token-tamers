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

| House      | Diet (model families)¹           | Theme            | Stat lean | Status       |
| ---------- | -------------------------------- | ---------------- | --------- | ------------ |
| **Aether** | `claude-*` · MiniMax             | ethereal / mind  | WIS       | Shipped (M1) |
| **Cipher** | `gpt-*`/`o*` · GLM · MiMo        | glyph / geometry | PWR       | Shipped (M1) |
| **Flux**   | `gemini-*` · Qwen · Kimi         | light / current  | SPD       | Lines in M2  |
| **Forge**  | `llama*` · `mistral*` · DeepSeek | metal / ember    | GRT       | Lines in M2  |
| **Wild**   | anything unmapped                | `???` silhouette | neutral   | Dormant gene |

¹ The glob patterns behind each: Aether `minimax*`/`abab*`; Cipher `glm*`/`codegeex*`,
`mimo*`; Flux `qwen*`/`qwq*`/`qvq*`, `kimi*`/`moonshot*`; Forge `deepseek*`. Matching is
**case-insensitive**, so a CamelCase slug like `MiniMax-Text-01` lands in Aether all the
same. Only popular families are mapped today — anything else (e.g. `phi*`, `gemma*`,
`yi-*`) rests in **Wild** until a future pack adopts it.

**M1 vs M2.** Aether and Cipher have their creature lines now. Flux and Forge pets wear
their House colors today but borrow the starter form until those lines arrive in M2 —
nothing is lost, and the House label and Diet are already correct.

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

## Wild — the dormant gene

**Wild** is the House for anything Token Tamers doesn't yet recognize. A brand-new
model ID with no mapping renders as a `???` silhouette with a neutral budget — not a
bug, a **dormant gene**. The registry is additive-only: when a future content pack (or
an [update](getting-started.md)) teaches the game that model's family, the gene
"awakens" and the silhouette resolves into its real House. Nothing is lost in the
meantime.

## See also

- [Game Guide](game-guide.md) — the vitals panel, where the Diet bar lives
- [Species](species.md) — the lineage shape each House grows along
- [Grades & the Archive](grades-and-archive.md) — what actually determines pet quality
