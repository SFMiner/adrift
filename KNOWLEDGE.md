---
type: knowledge
domain: coding
status: living
tags: [adrift, game-design, javascript]
created: 2026-05-05
updated: 2026-11-10
---

# KNOWLEDGE — Adrift (cold reference)

Cold reference for Adrift. Read on demand when working on this; not needed every session.
Moved out of the hot `CLAUDE.md` on 2026-10-07 (hot-log budget pass). `adrift_gdd.html` remains the
source of truth; `IMPLEMENTATION_PLAN.md` holds the build plan.

## Overview

A narrative game about the final moments of consciousness, a meditation on certainty, memory, and
authorship at the end of a life. The player walks a dark shoreline, gathers fragments of memory, and
spends limited "certainty" to resolve details about who they were.

Core design principles:
- Authorship over discovery: players build meaning through their choices, not discovery of predetermined story
- Quiet tone: melancholy without despair, like looking at an old photograph of someone loved
- Randomization + finitude: every playthrough is different in what surfaces *and* how much clarity the player has to spend
- The resource runs out; that is how the game ends — not with a choice to stop, but with the stopping itself

## Platform

- Vanilla HTML/JavaScript, no framework; deploy straight to itch.io (no build pipeline)
- Scope: 1–2 hours of gameplay per run
- Fallback: port to Godot if scope expands (see below)

## Core systems

### Fragment data (JSON)
- `data/fragments.json`: object store of 100+ fragments, editable without touching engine code
- Each fragment: prose text; type `sensory` or `relational`; optional questions (binary, open-ended,
	relational, temporal); sensory echoes (audio cue on pickup); tags for filtering and pool construction

### Certainty resource
- Randomized starting value within a range (range TBD)
- Never displayed as a number; felt through light (brightness = anchored memories, darkness = uncertainty)
- Each answered question costs certainty individually; spending is irreversible
- When exhausted, the game moves to its conclusion automatically

### Inventory
- On hand: 4–5 fragments held loosely (transparent overlay)
- Memory containers: unlimited groupings; placement is permanent
- Intentional race condition: the player can fill containers and run out of certainty before answering
	the questions inside them; unresolved questions render in softer type in the final reading

### Save system
- localStorage only (no server, no accounts)
- Each playthrough saved as a symbol (assembled from a library) + a point on a 2D emotional rating chart
- Gallery: scatter of all past runs' symbols and points

### Visual language
- Dark canvas, typography-forward
- Light is the primary dynamic element (anchored memories brighten; the world darkens as certainty is spent)
- No UI text for certainty
- Fragment representation: TBD (open question)

### Audio
- Shore ambience throughout (waves, wind, water on sand); no music
- Each fragment carries a faint echo of its sensory content, not the memory itself (e.g. distant bell,
	laughter, rustle of fire); plays softly on pickup or move

> **2026-11-10: the game is built.** The sections below are the pre-build design notes. Where they
> differ from the code, the code and `IMPLEMENTATION_PLAN.md` are right: audio is synthesised (no sample
> files yet), ES modules are used, and the actual files are listed in the plan.

## Recommended file structure

```
.
├── CLAUDE.md
├── adrift_gdd.html          # GDD (source of truth)
├── index.html
├── css/main.css             # typography-forward, light/dark dynamics
├── js/
│   ├── main.js              # entry point, game loop
│   ├── FragmentPool.js      # load, shuffle, draw fragment subsets
│   ├── Certainty.js         # resource tracking and visual feedback
│   ├── Inventory.js         # on-hand fragments, containers, placement
│   ├── Question.js          # question UI, certainty spending
│   ├── Environment.js       # shore, water, darkness progression
│   ├── Gallery.js           # localStorage save/load, display
│   ├── SymbolBuilder.js     # symbol assembly (layer, scale, position, brightness/contrast/saturation)
│   └── Audio.js             # ambient + fragment sounds
├── data/fragments.json      # master fragment library (100+)
└── assets/
    ├── audio/
    └── symbols/             # SVG/image library for symbol assembly
```

## Suggested implementation phases

1. Core loop: shore environment, fragment gathering, basic inventory
2. Certainty: randomized start, light feedback, exhaustion state
3. Questions & resolution: spending certainty, permanent effects
4. Containers: grouping, placement rules
5. Audio: ambient and fragment echoes
6. Ending: conclusion narrative, rating chart, symbol builder
7. Gallery & persistence
8. Polish & tuning: feel, balance, threshold moments

Fragment-authoring notes: keep tags meaningful for filtering and relational links; when adding or
modifying fragments, check sensory echoes and question costs in context; spread the pool across types,
time periods, and relational contexts.

## Godot migration path

If scope expands, port to Godot 4.5+: GDScript for logic/state, a shader for light/darkness progression,
audio buses for ambient + echoes, Tweens for UI transitions, 2D canvas for typography. Logic and data
structures carry over; mainly rendering and input change.

## Open Questions

All six have provisional values, accepted by Sean "for now" on 2026-11-10 and listed in
`IMPLEMENTATION_PLAN.md` § Decisions. They are to be revisited after the first playtest.

From GDD v0.4 (2026-05):
- Do all certainty questions cost the same, or does weight vary by question type?
- What is the range for randomized certainty? What do "low" vs "high" starting pools feel like in play?
- How many fragments are drawn per playthrough from the master library?
- How are on-hand fragments represented visually as objects on the shore?
- What does the world look like at full brightness vs near-total darkness; is there a threshold moment?
- What additional objects belong in the symbol library? (Current library in GDD)
