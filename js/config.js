// Every tunable number in the game. Values marked PROVISIONAL are the GDD's open questions,
// accepted "for now" by Sean on 2026-11-10; change them only on his word.

export const CONFIG = {
	// PROVISIONAL 1: what each kind of question costs.
	COST: { binary: 1, temporal: 1, occasion: 2, relational: 2, name: 3 },

	// PROVISIONAL 2: starting certainty, drawn uniformly, inclusive.
	// Raised from 8-24 on 2026-11-10 after Sean's first play: 8-24 completed about two fragments.
	// A fragment costs about 4 to resolve fully and a run offers about 120, so this resolves roughly
	// 10 fragments at the low end and 24 at the high end (the GDD's "four or five memories" to "a dozen").
	CERTAINTY_MIN: 40,
	CERTAINTY_MAX: 100,

	// PROVISIONAL 3: fragments drawn per run, and how many must be relational.
	POOL_SIZE: 30,
	POOL_MIN_RELATIONAL: 10,

	// PROVISIONAL 5: threshold moments.
	FAR_WATER_GONE_AT_SPENT: 0.5,	// the far water goes black once this share is spent
	WARMTH_GONE_AT_LEFT: 0.25,		// the sand loses its warmth once this share is left
	ANCHORS_ONLY_AT_LEFT: 0.10,		// below this, only memories give light

	// PROVISIONAL 6: the symbol library (file names in assets/symbols/, without .svg).
	SYMBOLS: [
		'leaf-green', 'leaf-autumn', 'oyster-shell', 'cigarette', 'cigar', 'wine-glass', 'shot-glass',
		'champagne-cork', 'keyboard', 'thumb-drive', 'key', 'clover', 'skull', 'butterfly',
		'butterfly-wing', 'pocket-knife', 'candle', 'matchbook', 'paw-print', 'fingerprint',
	],
	MAX_SYMBOL_LAYERS: 9,

	// Approved by Sean 2026-11-10.
	HAND_MAX: 5,
	GUTTER_SECONDS: 60,		// once nothing is left to gather or answer, the light goes out over this long

	// The shore (world units are CSS pixels at scale 1).
	WORLD_WIDTH: 6600,
	WALK_SPEED: 115,		// per second
	REACH: 80,				// how close you must be to gather
	WORDS_RADIUS: 170,		// a fragment's first words surface inside this
	SEE_RADIUS: 520,		// fragments are visible inside this at full light
	HEAR_RADIUS: 760,		// and audible inside this, so they are heard before they are seen

	HOLD_MS: 900,			// press and hold to make an answer certain
	FREE_ANSWER_MAX: 40,
	AXIS_PROMPTS: [['good', 'bad'], ['happy', 'sad'], ['deep', 'shallow'], ['regretted', 'accepted']],
};
