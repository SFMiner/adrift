# Fragment schema

`data/fragments.json` is a JSON array of fragment records. It is the only place fragment content
lives. Run `node tools/validate_fragments.mjs` after any edit.

```json
{
	"id": "d007",
	"type": "relational",
	"source": "draft",
	"text": "The smell of beer on their breath. Curly hair under your fingers. A whispered promise you believed.",
	"echo": { "recipe": "breath", "pitch": 1.0 },
	"valences": ["a first love", "a last goodbye"],
	"tags": ["touch", "night", "promise"],
	"questions": [
		{ "id": "q1", "kind": "binary", "prompt": "Was this the first time, or the last?",
			"statement": "It was the {} time.", "options": ["first", "last"] },
		{ "id": "q2", "kind": "name", "prompt": "What was their name?",
			"statement": "Their name was {}.", "options": ["Sam", "Alex", "Jo"], "free": true },
		{ "id": "q3", "kind": "temporal", "prompt": "When in your life was this?",
			"statement": "You were {}.", "options": ["young", "in the middle of your life", "old"] }
	]
}
```

## Fields

| Field | Rule |
|---|---|
| `id` | Unique. `s###` for Sean's library, `d###` for drafts. Never reuse or renumber: saved runs refer to ids. |
| `type` | `sensory` (smell, sound, texture, light) or `relational` (a moment with another person). |
| `source` | `sean` (his wording, never edited by anyone else) or `draft` (written by Claude, awaiting his verdict). |
| `text` | What the player reads. Second person where a person is needed ("you"); other people are "they" or "someone" so that gender, name and role stay open. No narration, no interpretation, no stated emotion. |
| `echo.recipe` | One of the recipe names below: a faint sound that suggests the fragment without explaining it. |
| `echo.pitch` | Optional, 0.6 to 1.6, default 1. Lower is larger, older, further away. |
| `echo.file` | Optional path to a recorded sample that replaces the recipe. |
| `valences` | At least two short phrases naming different memories this fragment could belong to. They should pull apart ("a wedding", "a wake"). Never shown to the player. |
| `tags` | Two to four lowercase words. Never shown to the player. |
| `questions` | Zero to four. Each fixes one detail, permanently, for a price. |

## Questions

| `kind` | Cost | Shape |
|---|---|---|
| `binary` | 1 | Exactly two `options`. |
| `temporal` | 1 | Three to five `options` about when in a life or a day or a year. |
| `occasion` | 2 | Three to five `options` as suggestions, `"free": true`. |
| `relational` | 2 | Three to six `options` naming what a person was to you, `"free": true`. |
| `name` | 3 | Three or four `options` as suggestions, `"free": true`. |

- `prompt` is the question as the player sees it before answering. Short. It asks for a fact, never
  for a meaning ("Who was beside you?", not "What did this mean to you?").
- `statement` is the sentence that appears once it is answered. It must contain `{}` exactly once, and
  every option must read correctly in that slot, as must a few words the player types.
- Options are lowercase unless they are names. No option may be a number written in digits.
- `free: true` lets the player type an answer of their own.
- Costs come from `kind` (see `js/config.js`), not from the record.

## Echo recipes

Animals: `birdsong` `trill` `caw` `quack` `shriek` `bark` `growl` `meow` `howl` `lowing` `croak` `peep` `hooves`
Weather and ground: `wind` `rain` `fire` `leaves` `water` `hiss` `footsteps`
Objects and machines: `bell` `clink` `clack` `modem` `phone` `alarm` `static` `engine` `brakes` `thud` `shot`
People: `breath` `heartbeat` `hum` `murmur` `laugh`
For fragments with no sound of their own (light, smell, pain): `shimmer` (bright, glassy) `drone` (low, dim)
