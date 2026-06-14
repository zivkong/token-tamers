# Houses

A **House** is your pet's identity — its theme, palette, and which species line it
grows along. Your House is decided by the **model-ID family** you code with: whatever
agent and model you already use picks the House for you. That's the _only_ thing the
model choice does.

> **No model judgment.** A House is cosmetics and identity, never power. Every House
> shares the **same stat budget** — no House is stronger, no model is "better food,"
> and your grades are judged against your own baseline, never your model. Houses are
> also the _only_ public vocabulary for provider identity: in battles and on shared
> DNA codes, the House shows, the provider name never does.

## The five Houses

| House      | Diet (model-ID family)           | Theme            | Stat lean | Status       |
| ---------- | -------------------------------- | ---------------- | --------- | ------------ |
| **Aether** | `claude-*`                       | ethereal / mind  | WIS       | Shipped (M1) |
| **Cipher** | `gpt-*` · `o1*`/`o3*`/`o4*`/`o*` | glyph / geometry | PWR       | Shipped (M1) |
| **Flux**   | `gemini-*`                       | light / current  | SPD       | Lines in M2  |
| **Forge**  | open-weight families¹            | metal / ember    | GRT       | Lines in M2  |
| **Wild**   | anything unmatched               | `???` silhouette | neutral   | Dormant gene |

¹ Forge covers the open-weight crowd — `llama*`, `qwen*`, `mistral*`, `deepseek*`,
`phi*`, `gemma*`.

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

Code mostly with `claude-*` and your pet lives an Aether life; lean into `gpt-*`/`o*`
and Cipher's geometry takes over. Mix providers and the Diet blends — which is exactly
how the hybrid lines and fusion specials of later milestones come into reach.

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
