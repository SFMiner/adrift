# Adrift — Implementation Plan

**Goal:** Ship a playable v1.0 to itch.io as a single HTML/JS bundle. No build pipeline, no dependencies, no server.

## Phase 0 — Foundations (½ day)

**Goal:** Get an empty page loading with the right typography and feel.

- `index.html`, `css/main.css`, `js/main.js` skeleton
- Cormorant Garamond + Inconsolata loaded (match GDD aesthetic)
- Black canvas, paper-tone overlay text, no UI chrome
- Debug toggle (URL param `?debug=1`) for showing certainty number, fragment IDs, etc.

**Done when:** Page loads on itch.io test upload with correct fonts and color palette.

## Phase 1 — Fragment Data Schema (1 day)

**Goal:** Lock in the JSON shape so writing can begin in parallel with code.

```json
{
  "id": "fragment_042",
  "text": "The smell of beer on their breath...",
  "type": "relational",
  "echo_sound": "audio/breath_low.ogg",
  "questions": [
    { "id": "q1", "kind": "binary", "prompt": "Their gender?", "options": ["man", "woman"], "cost": 1 },
    { "id": "q2", "kind": "open_suggested", "prompt": "Their name?", "suggestions": ["..."], "cost": 2 }
  ],
  "tags": ["intimacy", "first_or_last"]
}
```

**Tasks:**
- Schema doc in `data/SCHEMA.md`
- Seed `fragments.json` with 10 sample fragments spanning sensory/relational, all question types
- `FragmentPool.js`: load, validate, draw random subset

**Done when:** Console can `pool.draw(20)` and get a valid randomized subset.

**Decision needed:** Pool size per playthrough. Plan: start with 25–35, tune later.

## Phase 2 — Shoreline & Movement (2 days)

**Goal:** Walk the shore. See fragments. Pick them up.

- Bidirectional shore: ~3000px wide canvas, player is centered, world scrolls
- Fragments placed at random x positions along waterline
- Mouse/keyboard input: left/right movement, click/space to pick up nearby fragments
- Fragment visual: TBD — start with simple glyphs (circle for sensory, diamond for relational), iterate
- Fragments within ~150px of player play their echo sound softly (volume falls off with distance)

**Done when:** Player can walk shore, hear fragments before seeing them, pick them up into on-hand inventory.

## Phase 3 — Certainty & Light System (2 days)

**Goal:** The resource is a feeling, not a number.

- `Certainty.js`: tracks current/max, randomized starting value (range: 8–24, tune later)
- World lighting: shore brightness inversely proportional to certainty spent
- Anchored memories (containers with answered questions) emit local light that grows brighter
- Threshold moments: at ~75%, ~50%, ~25%, ~10% certainty — visible shifts in palette/opacity
- At 0: transition to ending sequence (Phase 7)

**Done when:** Spending certainty (debug button) visibly darkens shore and brightens nearby anchored memories.

**Decision needed:** Per-question costs. Plan: binary=1, open_suggested=2, name/identity=3.

## Phase 4 — Inventory & Containers (2 days)

**Goal:** Group fragments. Permanently.

- On-hand overlay: 4–5 fragments visible as transparent glyphs over shore
- Container creation: drag fragment to empty space → creates container; drag fragment onto container → adds
- Placement is permanent (visual cue: brief settling animation, no "are you sure")
- Containers visible as small constellation-like clusters; can be revisited
- Container view: opens question UI for fragments inside

**Done when:** Player can fill containers and revisit them; placement feels weighted but not punitive.

## Phase 5 — Question UI (1.5 days)

**Goal:** The act of fixing a detail.

- Question prompt overlay (calm, typography-only)
- Cost shown only as a faint visual (not a number) — a small light that will be consumed
- Answering: confirmation gesture (click + brief hold), then certainty visibly dims
- Answered questions render the chosen detail; unanswered remain ambiguous in final reading

**Done when:** Player can spend certainty to answer questions and see the world dim in response.

## Phase 6 — Audio Layer (1 day)

**Goal:** Half-remembered, never composed.

- `Audio.js`: WebAudio API, ambient bed (waves/wind loop) + per-fragment echo sounds
- Spatial falloff for fragments based on player distance
- No music. Source 6–10 ambient samples, ~20 fragment echoes at start, expand as fragments are written

**Done when:** Walking the shore feels alive without feeling scored.

## Phase 7 — Ending Sequence (2 days)

**Goal:** The reading.

- **Reading:** Containers presented in sequence, fragments rendered with answered details fixed and unresolved details in softer (italic, lower opacity) type
- **Rating Chart:** 2D plane, unlabeled axes, optional axis prompt suggestions, single point placement
- **Symbol Builder:** Layered SVG composer (scale, position, brightness/contrast/saturation per object)
- Symbol library: 14 objects from GDD as SVGs in `assets/symbols/`

**Done when:** Run reaches conclusion, player completes rating + symbol, output is captured.

## Phase 8 — Gallery & Persistence (1 day)

**Goal:** The cemetery / museum.

- `Gallery.js`: localStorage save format `{ symbol_data, point_xy, timestamp }`
- Gallery view: scatter plot of points with symbols rendered as small marks
- Hover/tap on a symbol: gentle highlight, no text
- Accessible from main menu and post-ending

**Done when:** Multiple runs accumulate visibly; gallery feels like a private archive.

## Phase 9 — Content Pass (ongoing, parallel)

**Goal:** Reach 100+ fragments.

- Write fragments in batches of 10–20
- Audit for double-valence (each should plausibly fit ≥2 contexts)
- Audit for sensory variety (not too many auditory; balance)
- Tag for distribution analysis
- Echo sound sourcing/recording per fragment

**Done when:** 100+ fragments authored, audited, and sounded.

## Phase 10 — Tuning & Polish (2 days)

- Certainty range tuning (playtest "low" vs "high" runs)
- Question cost tuning
- Visual threshold moments — make sure full→dark transition has at least one striking inflection
- Animation easing (settling, dimming, fragment pickup)
- Mobile/touch input fallback (itch.io often plays on tablets)

## Phase 11 — Ship (½ day)

- Bundle, test on itch.io draft
- Itch page copy (lean on GDD's "Question" thesis)
- Tag: narrative, atmospheric, short, free or pay-what-you-want

---

## Critical Path & Risks

**Critical path:** Phase 0 → 2 → 3 → 4 → 5 → 7. Audio (6) and gallery (8) can slip.

**Biggest risks:**
- **Fragment writing dwarfs coding.** 100+ fragments with double-valence, varied questions, and echo sounds is the long pole. Start writing in Phase 1, not Phase 9.
- **Light system feels gimmicky.** Mitigate by playtesting Phase 3 in isolation before committing to thresholds.
- **Permanent placement frustrates.** Mitigate with clear visual weight on the gesture; no take-backs but no surprises either.

## Open Decisions to Lock Before Phase 3

1. Certainty range (current plan: 8–24)
2. Pool size per playthrough (current plan: 25–35)
3. Per-question costs (current plan: binary=1, open=2, identity=3)
4. Fragment visual representation on shore (current plan: simple glyphs by type)
