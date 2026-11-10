# Adrift

A narrative game about the last moments of a mind. You walk a dark shore, gather fragments of a life,
keep them together as memories, and spend what certainty is left to fix details of who you were. When
the certainty is gone, the game ends and you read what you made.

Design: `adrift_gdd.html`. Build plan and decisions: `IMPLEMENTATION_PLAN.md`. Fragment format:
`data/SCHEMA.md`.

## Run it

Browsers will not load the fragment file from `file://`, so serve the folder:

```powershell
python -m http.server 8765
```

Then open <http://localhost:8765/>. Add `?debug=1` to see certainty, fragment ids and state;
`?debug=1&seed=7` replays one run; `&speed=6` fast-forwards. None of these do anything without `debug`.

Controls: arrow keys or A/D walk, Space gathers, E shows what you hold, Esc closes, M mutes. Or click
and touch: the shore to walk, a light to gather it, the lights at the bottom to see what you hold.

## Check it

```powershell
node tools/validate_fragments.mjs      # the fragment library
node tests/web/run_check.cjs           # a bot plays 20 seeded runs to the gallery (about 4 minutes)
node tests/web/shots.cjs               # screenshots of every screen and light level, in tests/web/shots
pwsh tools/package.ps1                 # dist/adrift.zip for itch.io
node tests/web/run_check.cjs dist/adrift   # the same bot against the packaged copy
```

The bot uses the Chrome on this machine through the Playwright in `Website\game-sim-server`; set
`PLAYWRIGHT_PATH` if that moves.

## Features

- [x] Title, with continue / begin again (held) when a run is in progress
- [x] Shore: scrolling, bidirectional, dark at both ends; walk by key, click or touch
- [x] Fragments drawn per run from the library (30, at least 10 relational), seeded
- [x] Fragments as points of light; first words surface when near; gather and set back down
- [x] Certainty: random start (40-100), never shown; spent only by answering
- [x] Light: world darkens as certainty is spent; far water goes at half, warmth at a quarter, only memories under a tenth
- [x] On hand: up to five, shown as a transparent overlay over the shore
- [x] Memories: unlimited containers shown as constellations; placing is permanent; click or drag or keyboard
- [x] Questions: binary, temporal, occasion, relational, name; free entry where allowed; press and hold to fix
- [x] Cost shown only as a small light that is consumed
- [x] Ending without announcement when certainty runs out; the light also gutters out when nothing is left to fix
- [x] The reading: fixed details in full type, open questions in soft type
- [x] Rating chart: unlabelled plane, optional axis prompts, one point
- [x] Symbol builder: 20 objects; layer, move, scale, turn; brightness, contrast, saturation
- [x] Gallery: symbols at their points, no text; saved in localStorage
- [x] Autosave of the run in progress; works with storage blocked (itch iframe)
- [x] Audio: synthesised shore bed and 38 echo recipes; fragments heard before seen; no music
- [x] Fragment library: Sean's 108 in his wording, plus 42 drafts awaiting his verdict
- [x] Validator, bot, screenshot pass, itch package
- [ ] Sean's playtest (`PLAYTEST.md`): audio by ear, fragment and question quality, feel of the light, run length
- [ ] Sean's verdict on the 42 draft fragments and on the questions written for his own
- [ ] Recorded samples for the animal calls that need them
- [ ] itch.io page and upload
