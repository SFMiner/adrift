// node tools/validate_fragments.mjs
// Checks data/fragments.json: schema, Sean's wording untouched, balance, and that the per-run draw
// always meets its floor. Exits non-zero on any error; warnings do not fail.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateFragments, drawPool, costOf } from '../js/FragmentPool.js';
import { CONFIG } from '../js/config.js';
import { makeRng } from '../js/rng.js';
import { RECIPE_NAMES } from '../js/Audio.js';
import { readLibrary } from './import_library.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const list = JSON.parse(readFileSync(join(root, 'data', 'fragments.json'), 'utf8'));
const errors = validateFragments(list, RECIPE_NAMES);
const warnings = [];

// Sean's fragments must match his library file word for word.
const library = readLibrary();
const libraryTexts = new Set(library.map((f) => f.text));
const sean = list.filter((f) => f.source === 'sean');
for (const f of sean) {
	if (!libraryTexts.has(f.text)) errors.push(`${f.id}: text is not in adrift-fragment-library.md word for word: "${f.text}"`);
}
const present = new Set(sean.map((f) => f.text));
for (const f of library) {
	if (!present.has(f.text)) warnings.push(`library entry not in fragments.json: "${f.text}"`);
}

// Every fragment's picture must exist as a drawing.
for (const f of list) {
	if (typeof f.symbol === 'string' && !existsSync(join(root, 'assets', 'symbols', f.symbol + '.svg'))) errors.push(`${f.id}: no drawing assets/symbols/${f.symbol}.svg`);
}
if (!existsSync(join(root, 'assets', 'symbols', CONFIG.SYMBOL_FALLBACK + '.svg'))) errors.push('the fallback drawing is missing');

if (list.length < 100) errors.push(`only ${list.length} fragments; the GDD asks for at least a hundred`);
const relational = list.filter((f) => f.type === 'relational');
if (relational.length < CONFIG.POOL_MIN_RELATIONAL) errors.push(`only ${relational.length} relational fragments; a run needs ${CONFIG.POOL_MIN_RELATIONAL}`);
if (relational.length < CONFIG.POOL_MIN_RELATIONAL * 3) warnings.push(`${relational.length} relational fragments: runs will repeat them often`);

const texts = new Map();
for (const f of list) {
	const key = f.text.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
	if (texts.has(key)) warnings.push(`${f.id} repeats the text of ${texts.get(key)}`);
	texts.set(key, f.id);
}

// The draw: floors hold, sizes hold, over many seeds.
const kinds = {};
let questions = 0;
for (const f of list) for (const q of f.questions) { kinds[q.kind] = (kinds[q.kind] || 0) + 1; questions++; }
let worst = Infinity;
let costSum = 0;
const DRAWS = 10000;
for (let seed = 1; seed <= DRAWS; seed++) {
	const pool = drawPool(list, makeRng(seed));
	if (pool.length !== Math.min(CONFIG.POOL_SIZE, list.length)) { errors.push(`seed ${seed}: drew ${pool.length}`); break; }
	if (new Set(pool.map((f) => f.id)).size !== pool.length) { errors.push(`seed ${seed}: drew a fragment twice`); break; }
	const rel = pool.filter((f) => f.type === 'relational').length;
	worst = Math.min(worst, rel);
	for (const f of pool) for (const q of f.questions) costSum += costOf(q);
}
if (worst < CONFIG.POOL_MIN_RELATIONAL) errors.push(`a draw had only ${worst} relational fragments`);

console.log(`${list.length} fragments: ${sean.length} sean, ${list.length - sean.length} draft; ${relational.length} relational, ${list.length - relational.length} sensory`);
console.log(`${questions} questions: ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`a run offers about ${Math.round(costSum / DRAWS)} certainty worth of questions against a pool of ${CONFIG.CERTAINTY_MIN}-${CONFIG.CERTAINTY_MAX}`);
console.log(`fewest relational fragments in ${DRAWS} draws: ${worst}`);
for (const w of warnings) console.log('warning: ' + w);
for (const e of errors) console.error('ERROR: ' + e);
console.log(errors.length ? `${errors.length} error(s)` : 'ok');
process.exit(errors.length ? 1 : 0);
