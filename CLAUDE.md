# CLAUDE.md — Adrift

Narrative game: a dying consciousness walks a dark shore, gathers memory fragments, and spends a finite
"certainty" resource to fix details of who they were. The game ends when certainty runs out.

**Status (2026-11-10):** the whole game is built and passes its bot. Sean played an early run remotely; portraits
were added after it and have been played only by the bot.
Next: Sean's playtest (`PLAYTEST.md`), then fixes and the itch upload. Feature checklist: `README.md`.
**Source of truth:** `adrift_gdd.html`. Plan and settled decisions: `IMPLEMENTATION_PLAN.md`. Fragment
format: `data/SCHEMA.md`. Background and Godot port notes: `KNOWLEDGE.md`.

## Working on it

- Serve the folder (`python -m http.server 8765`); `file://` cannot load the fragments or the modules.
- After any change run `node tools/validate_fragments.mjs` and `node tests/web/run_check.cjs`, then look
	at `node tests/web/shots.cjs` output yourself. Before shipping, `pwsh tools/package.ps1` and run the bot
	on `dist/adrift`.
- Debug hooks (`?debug=1`, `seed`, `speed`, `window.__adrift`) must do nothing without `debug`.

## Rules

- **Vanilla HTML/JS, no framework, no build step**: it ships as plain files to itch.io. Don't add a
	bundler or dependencies without asking. (`package.json` exists only to mark the files as ES modules.)
- **All tunable numbers live in `js/config.js`.** Don't scatter constants into the modules.
- **Fragment content lives only in `data/fragments.json`**, fully decoupled from engine code. Designers
	edit it without touching JS.
- **Persistence is localStorage only**: no server, no accounts.
- **Never show certainty as a number or UI text.** It is shown only through light: the world darkens
	as it's spent.
- **Irreversibility is the design**: placing a fragment in a portrait, answering a question and setting a
	portrait are all permanent. Don't add undo.
- **A container is a portrait** (Sean, 2026-11-10): a frame of fragment pictures the player arranges and captions,
	then sets; set portraits show as stars. Rules and the choices still awaiting his word: `IMPLEMENTATION_PLAN.md`
	§ Portraits. In code the data is still `run.containers`.
- **No narration, no scoring, no win/lose framing, no music.** The story comes from what the player
	assembles. The tone is quiet: shore ambience plus faint fragment echoes.
- **Fragments are written with double valence.** Each must plausibly belong in more than one container
	(a first kiss *or* a funeral). Details stay ambiguous until certainty is spent on them.
- **Sean's fragments keep his wording.** `adrift-fragment-library.md` is his working list; its entries go into
	`fragments.json` verbatim as `"source": "sean"`. Anything Claude writes is `"source": "draft"` until he accepts it.
- **The gallery shows only the symbols and rating points**, never text summaries or metadata.
- Don't settle open design questions on your own; ask Sean. The GDD's six have provisional values he accepted
	"for now" (2026-11-10), listed in `IMPLEMENTATION_PLAN.md` and held in `js/config.js`. Change them only on his word.
