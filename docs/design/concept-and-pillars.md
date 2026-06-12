# Token Tamers — Concept and Design Pillars

Derived from the v1.0.3 design baseline. Covers §1 (Concept), §2 (Design Pillars), and §16
(Motivation Stack).

---

## 1. Concept (design baseline §1)

**Token Tamers** is a fully idle, terminal-based virtual pet game for developers. An evolving
monster companion is raised passively by the developer's real AI coding-agent usage — no
interaction required. The game observes **local usage data from the developer's coding agent of
choice** (Claude Code, Codex CLI, or OpenCode) and converts actual work patterns into pet growth,
evolution, battles, and breeding.

**One-liner:** _Your work raises a monster. Literally. Whatever agent you use._

**Player goal:** complete the collection — every Dex entry, achievement, habitat, and trinket.
A fully offline completionist journey.

### Critical platform constraint (applies to ALL providers)

Token Tamers **never calls any AI API and never spends the user's tokens or quota**. Provider
policies generally prohibit using subscription credentials in third-party tools. The game is
therefore a **passive, read-only observer**: a local daemon reads each agent's local session logs
and gamifies them. The pet grows because the dev shipped real work, not because a script burned
tokens.

---

## 2. Design Pillars (design baseline §2)

These eight pillars are **normative** — they are binding design constraints that govern every
feature, mechanic, and content decision in the game.

1. **Fully idle.** Zero required interaction. The game _is_ your job. Viewing the pet is
   optional; progress never depends on it.

2. **No model judgment.** Model choice may only influence _species identity and cosmetics_ —
   never stats, rarity, grades, or progression speed. All power metrics are normalized against
   the player's **own baseline per provider**, not absolute token volume. An all-light-model dev
   and an all-frontier-model dev with similar work patterns raise equally strong pets.
   (Write this promise into the README.)

3. **Horizontal evolution.** Every final form has an equal total stat budget, distributed
   differently. Different builds, not better builds.

4. **Version agnostic.** Hashes/DNA codes outlive game versions. Content is data, not code.
   Additive-only registries. Every hash ever shared stays valid forever.

5. **Provider agnostic.** No coding agent is privileged. Providers are adapter plugins emitting
   one normalized event stream; the game engine never knows or cares which agent produced an
   event. Cross-provider battles and DNA merges are first-class (a Codex dev can battle a
   Claude Code dev).

6. **Social by DNA.** Solo players get a complete game; the rarest third of the collection
   requires trading DNA with colleagues.

7. **Fully local, zero internet.** The game NEVER touches the network: no API calls, no
   telemetry, no update checks, no remote content, no sync. All social features work by humans
   exchanging text codes (paste over chat); all "shared world" features (weather, Drifter DNA)
   are derived deterministically from the calendar so every offline machine agrees. Content
   arrives only when the user installs an update themselves.

8. **Completionist North Star.** The goal of the game is **100% completion** — fill the Dex,
   earn every achievement, unlock every habitat and trinket. Grades are a texture of the journey
   (and gate some achievements), but the destination is the collection, not the grade.

---

## 16. Motivation Stack (design baseline §16)

Daily idle growth → weekly arc/rebirth → social DNA/battles/weather → the year-long
completionist climb: Dex, achievements, habitats, trinkets — one Completion Meter to drive to
100% (grades flavor the journey, completion IS the goal). Better records mint better DNA →
better DNA breeds better lineages.
