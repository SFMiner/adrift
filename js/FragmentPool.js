// Loading, checking and drawing fragments. No DOM here, so tools/validate_fragments.mjs can import it.
import { CONFIG } from './config.js';
import { shuffle } from './rng.js';

export async function loadFragments(url = 'data/fragments.json') {
	const res = await fetch(url);
	if (!res.ok) throw new Error('could not load ' + url);
	return res.json();
}

const SHAPES = {
	binary: { min: 2, max: 2, free: false },
	temporal: { min: 3, max: 5, free: false },
	occasion: { min: 3, max: 5, free: true },
	relational: { min: 3, max: 6, free: true },
	name: { min: 3, max: 4, free: true },
};

// Returns a list of problems; empty means the library is sound.
export function validateFragments(list, recipeNames = null) {
	const errors = [];
	if (!Array.isArray(list)) return ['fragments.json is not an array'];
	const ids = new Set();
	for (const f of list) {
		const at = f && f.id ? f.id : JSON.stringify(f).slice(0, 40);
		const bad = (msg) => errors.push(`${at}: ${msg}`);
		if (!f || typeof f !== 'object') { bad('not an object'); continue; }
		if (!/^[sd]\d{3}$/.test(f.id || '')) bad('id must look like s001 or d001');
		if (ids.has(f.id)) bad('duplicate id');
		ids.add(f.id);
		if (f.type !== 'sensory' && f.type !== 'relational') bad('type must be sensory or relational');
		if (f.source !== 'sean' && f.source !== 'draft') bad('source must be sean or draft');
		if (typeof f.text !== 'string' || !f.text.trim()) bad('missing text');
		else if (/\d/.test(f.text)) bad('text contains a digit');
		if (!f.echo || typeof f.echo.recipe !== 'string') bad('missing echo.recipe');
		else if (recipeNames && !recipeNames.includes(f.echo.recipe)) bad(`unknown echo recipe "${f.echo.recipe}"`);
		if (f.echo && f.echo.pitch !== undefined && !(f.echo.pitch >= 0.5 && f.echo.pitch <= 2)) bad('echo.pitch out of range');
		if (!Array.isArray(f.valences) || f.valences.length < 2) bad('needs at least two valences');
		if (!Array.isArray(f.tags) || f.tags.length < 1) bad('needs tags');
		if (!Array.isArray(f.questions)) { bad('questions must be an array'); continue; }
		if (f.questions.length > 4) bad('more than four questions');
		const qids = new Set();
		for (const q of f.questions) {
			const qbad = (msg) => bad(`${q && q.id}: ${msg}`);
			if (!q || !q.id) { bad('question without id'); continue; }
			if (qids.has(q.id)) qbad('duplicate question id');
			qids.add(q.id);
			const shape = SHAPES[q.kind];
			if (!shape) { qbad(`unknown kind "${q.kind}"`); continue; }
			if (typeof q.prompt !== 'string' || !q.prompt.trim()) qbad('missing prompt');
			if (typeof q.statement !== 'string' || q.statement.split('{}').length !== 2) qbad('statement needs exactly one {}');
			if (!Array.isArray(q.options) || q.options.length < shape.min || q.options.length > shape.max) {
				qbad(`${q.kind} needs ${shape.min}-${shape.max} options`);
			} else {
				for (const o of q.options) {
					if (typeof o !== 'string' || !o.trim()) qbad('empty option');
					else if (/\d/.test(o)) qbad(`option "${o}" contains a digit`);
				}
				if (new Set(q.options).size !== q.options.length) qbad('repeated option');
			}
			if (shape.free && q.free !== true) qbad(`${q.kind} must have "free": true`);
			if (!shape.free && q.free) qbad(`${q.kind} must not be free`);
			if (/\d/.test((q.prompt || '') + (q.statement || ''))) qbad('prompt or statement contains a digit');
		}
	}
	return errors;
}

// Draw the fragments for one run: POOL_SIZE of them, at least POOL_MIN_RELATIONAL relational.
export function drawPool(list, rand, cfg = CONFIG) {
	const size = Math.min(cfg.POOL_SIZE, list.length);
	const relational = shuffle(rand, list.filter((f) => f.type === 'relational'));
	const chosen = relational.slice(0, Math.min(cfg.POOL_MIN_RELATIONAL, relational.length, size));
	const taken = new Set(chosen.map((f) => f.id));
	const rest = shuffle(rand, list.filter((f) => !taken.has(f.id)));
	for (const f of rest) {
		if (chosen.length >= size) break;
		chosen.push(f);
	}
	return shuffle(rand, chosen);
}

// Scatter the drawn fragments along the shore: one per stratum, jittered, so they never bunch up.
export function scatter(pool, rand, cfg = CONFIG) {
	const margin = 320;
	const span = cfg.WORLD_WIDTH - margin * 2;
	const step = span / pool.length;
	return pool.map((f, i) => ({
		id: f.id,
		x: Math.round(margin + step * i + step * (0.15 + 0.7 * rand())),
		y: Math.round(rand() * 100) / 100,	// 0 = at the waterline, 1 = up the sand
	}));
}

export function costOf(question, cfg = CONFIG) {
	return cfg.COST[question.kind] ?? 1;
}
