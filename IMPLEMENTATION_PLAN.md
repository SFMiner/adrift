# Adrift — Implementation Plan (v2, 2026-11-10)

Replaces the May plan (`IMPLEMENTATION_PLAN.v1-2026-05.md`), which was phased for a human working
day by day. This one is shaped for agent sessions: two build sessions and one human playtest.
`adrift_gdd.html` stays the source of truth.

## Status (2026-11-10, end of session 1)

Session 1 is done: every item below is built, and `README.md` has the checklist. Verified by machine:
the validator, and the bot (20 seeded runs, a storage-blocked run, a run at real speed without debug,
the gutter ending, seed reproducibility, all 38 echo recipes), on both the source folder and the
unzipped `dist/adrift`. Not verified by anyone: how it sounds, how it reads, how the light feels, and
how long a run takes. That is the playtest.

What differs from the plan as written below:

- **Questions can be answered only once a fragment is in a memory**, not while it is held. The GDD
  allows either reading; this one makes placement matter. Sean to confirm in the playtest.
- **150 fragments**, not 160: Sean's 108 plus 42 drafts (36 relational).
- **One audio recipe set, 38 names**, not 16. Synthesis was written by a Sonnet agent and checked only
  by measurement.
- **A `turn` control** was added to the symbol builder alongside scale and position.
- Test scripts are `tests/web/run_check.cjs` and `shots.cjs`; a `package.json` marks `js/` as modules.
- `.claude/settings.local.json` was not updated for the local server: the permission system refused
  the edit as self-modification. Sean can add the entries if the prompts annoy him.

## Where the project stood before session 1

Only the scaffold exists: `index.html`, `css/main.css`, and a 96-line `js/main.js` that draws an
animated dark waterline and fades out the title screen. `data/`, `assets/audio/` and
`assets/symbols/` are empty. No gameplay, no tests, no git repository. This folder is the canonical
copy (Sean, 2026-11-10); the one under `obsidian-files\Coding\Adrift` is the stale original.

Sean's `adrift-fragment-library.md` holds 108 fragments. Nearly all are short sensory seeds
("The trill of a woodpecker", "A found coin"), about 40% of them sounds; only about five are
relational.

## Human involvement, in total

| When | What Sean does | Time |
|---|---|---|
| Before session 1 | Nothing: all decisions are settled (2026-11-10) | 0 |
| After session 1 | One full playthrough with sound on, in Chrome, filling in `PLAYTEST.md` | 1-2 h |
| After session 2 | Upload `dist/adrift.zip` to itch.io and write the page (or install `butler` and hand over the push) | 15 min |

Everything else is automated. The three things an agent cannot judge are how the audio sounds, whether
the fragments read true, and whether the light change feels right. The playtest covers exactly those.

## Decisions (settled 2026-11-10)

Items 1-6 are the GDD's open questions. Sean accepted the defaults below "for now" on 2026-11-10: they
are provisional, to be revisited after the playtest. Each is a constant in `js/config.js`, so changing
one later costs nothing.

1. **Question cost.** Default: binary 1, temporal 1, occasion (open with suggestions) 2, relational 2,
   name 3.
2. **Certainty range.** 40-100, drawn uniformly (Sean, 2026-11-10: "far more" after his first play;
   the first value, 8-24, completed only about two fragments). A fragment costs about 4 to resolve
   fully, so this resolves roughly 10 fragments at the low end and 24 of the 30 at the high end.
3. **Fragments per run.** Default: 30 drawn from the library, with a floor of 10 relational so every
   run has people in it. (The relational set is small, so a higher floor would repeat the same ones
   run after run.)
4. **Fragment look on the shore.** Default: a small point of warm light at the waterline (round for
   sensory, elongated for relational). Its first few words surface in faint type when the player stands
   near it; the full text shows only when held.
5. **Threshold moments.** Default: at 50% spent the far water goes to black; at 25% left the sand loses
   its warmth; under 10% only containers give light.
6. **Symbol library.** Default: the GDD's 20 objects, no additions for v1.

Gaps the GDD does not cover:

7. **Ending when the player can't or won't spend (approved; this was the intent).** Certainty can't be spent if every remaining
   question is answered, or never is if the player refuses. Default: the last answer is always
   affordable (cost is capped at what remains); and once every drawn fragment is in a container and no
   questions remain, the remaining light gutters out over about a minute. A player who never answers
   anything can walk forever; the game does not force them.
8. **Who writes the fragments (settled).** Sean's library goes in first, every entry in its original
   wording, marked `"source": "sean"`. Claude adds the metadata each needs (questions, echo, valences,
   tags) and drafts about 40 more, mostly relational, marked `"source": "draft"` for Sean to accept,
   rewrite or cut in the final pass. The three "possible overlaps" pairs stay as separate fragments
   until Sean decides.
9. **Audio source.** Default: synthesised with the Web Audio API, no sample files. Synthesis suits the
   shore bed and the mechanical and weather sounds in the library (modem, radio static, phone, alarm,
   typewriter, rain, wind, fire, footsteps, metal on metal). It does not suit the roughly 20 animal
   calls: a synthesised duck or eagle will sound like a toy. Those get a distant, filtered suggestion
   of the call's rhythm and pitch, and `PLAYTEST.md` lists them so Sean can mark which need a real
   recording. The schema's optional `file` field takes a sample for any fragment.
10. **Mid-run autosave (approved).** A run is 1-2 hours, and a closed tab should not erase it. It
    restores the exact state, so it adds no undo.
11. **Full hands (approved).** With five fragments held, the player must place one or set one back down
    on the shore where they stand before picking up another. Held fragments are uncommitted, so setting
    one down breaks no rule.

## Technical choices already made

- **ES modules, no bundler.** `fetch('data/fragments.json')` and modules both fail on `file://`, so
  double-clicking `index.html` stops working. Run `python -m http.server 8765` in the folder; itch.io
  serves over https, so the shipped game is unaffected. Session 1 swaps the two `start index.html`
  permissions in `.claude/settings.local.json` for the server and its `localhost` URLs.
- **Fonts are self-hosted** in `assets/fonts/` (Cormorant Garamond and Inconsolata, both OFL), so the
  game makes no third-party request and works offline in the itch app.
- **Symbols are inline-style SVG files** drawn by hand in code, one per object, in a single muted
  line-and-wash style. The builder applies scale, position, layer order, and CSS
  `brightness/contrast/saturate`.
- **localStorage is wrapped in try/catch.** Itch runs the game in a cross-origin iframe where storage
  can be blocked; the game must still play, with the gallery held in memory for that visit.
- **Deterministic runs for testing:** `?seed=N` fixes the draw and the certainty roll; `?debug=1`
  shows certainty and fragment ids and exposes `window.__adrift` (state, `spend(n)`, `skipTo(phase)`).
  Neither exists without the URL parameter.
- **Input:** arrow keys / A-D and click-to-walk; space or click to pick up; drag or keyboard to place;
  touch works throughout (itch is often played on tablets).

## File layout

```
index.html
css/main.css
js/main.js            entry, state machine: title → shore → ending → rating → symbol → gallery
js/config.js          every tunable constant (the decisions above)
js/rng.js             seeded PRNG
js/FragmentPool.js    load, validate, draw
js/Certainty.js       pool, spend, thresholds, light level
js/Environment.js     shore canvas, scrolling, light and darkness
js/Inventory.js       on-hand overlay, containers, placement
js/Question.js        question overlay, hold-to-confirm
js/Audio.js           shore bed, echo recipes, distance falloff
js/Ending.js          the reading
js/RatingChart.js
js/SymbolBuilder.js
js/Gallery.js         save, load, scatter view
js/Save.js            localStorage wrapper, autosave
data/fragments.json   about 150 fragments (Sean's library plus drafts)
data/SCHEMA.md
assets/fonts/  assets/symbols/
tools/import_library.mjs   one-time import of adrift-fragment-library.md
tools/validate_fragments.mjs
tools/package.ps1     builds dist/adrift.zip (game files only)
tests/web/run_check.js   Playwright bot
README.md             feature checklist
PLAYTEST.md           the sheet Sean fills in
```

Fragment schema (changes from v1: `echo` is a recipe, questions carry a `kind` that sets cost,
`valences` records the contexts a fragment must plausibly fit, and `source` is `sean` or `draft`):

```json
{
	"id": "f042",
	"type": "relational",
	"source": "draft",
	"text": "The smell of beer on their breath. Curly hair under your fingers. A whispered promise you believed.",
	"echo": { "recipe": "breath", "seed": 42 },
	"valences": ["first love", "last goodbye"],
	"tags": ["touch", "night", "promise"],
	"questions": [
		{ "id": "q1", "kind": "binary", "prompt": "Their gender?", "options": ["a man", "a woman"] },
		{ "id": "q2", "kind": "name", "prompt": "Their name?", "suggestions": ["Sam", "Alex", "Jo"], "free": true },
		{ "id": "q3", "kind": "temporal", "prompt": "When in your life?", "options": ["young", "in the middle", "near the end"] }
	]
}
```

In the reading, an answered question appends its fixed detail in full type; an unanswered one shows
its prompt in soft italic.

## Session 1 — build the whole game

One session, with the fragment writing running in parallel because it depends only on the schema.

1. **Setup.** `git init` (commits only when Sean asks), README checklist, `config.js` with the locked
   decisions, schema doc, validator, fonts downloaded.
2. **Content, in the background.** `tools/import_library.mjs` turns Sean's library into fragment
   records with the text untouched. Two Sonnet agents then split the work: one attaches questions,
   valences, tags and an echo recipe to each imported fragment; the other drafts about 40 new ones,
   mostly relational, in the manner of the GDD's two examples. The main session reads every record,
   fixes weak questions, cuts weak drafts, and runs the validator. After the import,
   `data/fragments.json` is the only copy that matters; new fragments are added there.
3. **Shore and movement.** Scrolling world about 3000 px wide, fragments placed from the seeded draw,
   pick up, set down.
4. **Certainty and light.** Roll, spend, global darkening, container glow, the three thresholds.
5. **Inventory and containers.** Transparent on-hand overlay; drag to empty space creates a container,
   drag onto one adds to it; a settling animation and no confirmation prompt.
6. **Questions.** Typographic overlay, cost shown as a small light that is consumed, press-and-hold to
   answer, free-text entry where the question allows it.
7. **Audio.** Shore bed, echo recipes, distance falloff so a fragment is heard before it is seen. Starts
   on the first click, as browsers require.
8. **Ending.** The reading, then the rating chart (unlabelled, with the optional axis prompts), then
   the symbol builder with all 20 SVGs.
9. **Gallery and saving.** Run record `{ symbol, point, timestamp }`, scatter view from the title and
   after the ending, autosave of the run in progress.
10. **Package.** `tools/package.ps1` builds the zip; the bot is re-run against the unzipped copy.

### How it is verified without a person

- **Validator** (`node tools/validate_fragments.mjs`): schema, unique ids, at least 100 fragments, at
  least two `valences` each, question-kind balance, every echo recipe exists, every `sean` fragment's
  text identical to its line in the library file, and a 10,000-draw check that the pool floor always
  holds.
- **Playwright bot** (`tests/web/run_check.js`, using Chrome through the Playwright already installed in
  `Website\game-sim-server\node_modules`): for seeds 1-20 it plays a full run from title to gallery
  with real key and pointer events, and fails on any console error. It asserts that certainty reaches
  zero and the ending starts without a prompt; that a placed fragment cannot be moved; that an answered
  question cannot be re-answered; that with `debug` off no number or id appears anywhere in the page
  text; that the gallery holds one more entry after a reload; and that the game still completes with
  localStorage blocked.
- **Screenshots** at full light, 50%, 25% and zero, at 1366×768, 1180×500 and a phone size, which the
  session opens and inspects for clipping, overlap, and whether the thresholds are visible at all.
- **Audio**: each echo recipe is rendered through an `OfflineAudioContext` and checked for non-silence,
  no clipping, and a peak well below the shore bed. This shows that the audio runs, not that it sounds
  good.

Session 1 ends when the validator and all 20 bot runs pass on the packaged zip, and the README
checklist is ticked to match.

## Playtest (Sean)

`PLAYTEST.md` asks for one run with headphones in Chrome and has short prompts: which fragments read
false or single-meaning; which echoes are wrong or too loud; which animal calls need a recording; whether the darkening is felt before it
is noticed; whether placement felt weighted; how long the run took against the 1-2 hour target; and
anything that broke. A second run with `?seed=` at the low end of the certainty range is optional but
tells us whether a thin life still feels complete.

## Session 2 — fix and ship

Apply the playtest notes and Sean's verdicts on the `draft` fragments: rewrite flagged fragments, retune `config.js`, adjust recipes and
thresholds, fix bugs. Re-run the validator and bot, rebuild the zip, draft the itch page copy from the
GDD's "The Question" section. Sean uploads.

## Risks

- **Two registers of fragment.** Sean's are a few words each; the GDD's examples and the relational
  drafts are three sentences. The short ones leave more open, which suits the design, but the reading
  at the end will alternate between the two. Judge it in the playtest.
- **The questions on Sean's fragments are Claude's.** A bare "The caw of a crow" needs questions
  written for it (where, when, who was there). They shape the game as much as the fragments do and
  can't be tested mechanically; the validator only checks that two contexts are claimed.
- **Animal echoes** are the weakest audio (see decision 9).
- **Run length.** Thirty fragments and 8-24 certainty may play in 30-45 minutes, not 1-2 hours. That
  can only be measured in the playtest; the fix is the pool-size constant.
- **Symbol art** drawn in code will be plain. Each object is a separate SVG file, so any can be
  replaced without touching the builder.
- **Session 1 is large.** The README checklist is the resume point if it is interrupted.
