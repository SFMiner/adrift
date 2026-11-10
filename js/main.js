// Adrift: entry point and state machine.
// title -> shore -> ending -> reading -> rating -> symbol -> gallery -> title
import { CONFIG } from './config.js';
import { makeRng, randomSeed } from './rng.js';
import { store, KEYS } from './Save.js';
import { loadFragments, drawPool, scatter, costOf } from './FragmentPool.js';
import { rollCertainty, spend, lightOf, lightState } from './Certainty.js';
import { Environment } from './Environment.js';
import { Inventory } from './Inventory.js';
import { MemoryView } from './Question.js';
import { Reading } from './Ending.js';
import { RatingChart } from './RatingChart.js';
import { SymbolBuilder } from './SymbolBuilder.js';
import { Gallery, loadGallery, saveToGallery } from './Gallery.js';
import { ShoreAudio } from './Audio.js';
import { normalisePortrait } from './Portrait.js';
import { $, clamp, showScreen, holdToConfirm } from './ui.js';

// === DEBUG GATES (only ever active with ?debug=1) ===
const params = new URLSearchParams(window.location.search);
const DEBUG = params.has('debug');
const SPEED = DEBUG ? clamp(Number(params.get('speed')) || 1, 1, 30) : 1;
const FIXED_SEED = params.has('seed') ? (Number(params.get('seed')) >>> 0) : null;

const root = $('#game');
const hintNode = $('#hint');

const game = {
	cfg: CONFIG,
	lib: new Map(),		// id -> fragment
	list: [],
	run: null,			// the run in progress (plain data; this is what is autosaved)
	phase: 'title',
	overlay: null,		// 'hand' | 'memory' (a portrait) | null
	moving: false,
	env: new Environment($('#shore')),
	audio: new ShoreAudio(),
	target: lightState(1),

	wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms / SPEED)),
	holdMs: () => CONFIG.HOLD_MS / SPEED,

	answerOf(fragId, qid) {
		const a = this.run.answers[fragId];
		return a ? a[qid] : undefined;
	},

	nearestInReach() {
		const run = this.run;
		let best = null;
		let bestD = CONFIG.REACH;
		for (const f of run.shore) {
			const d = Math.abs(f.x - run.playerX);
			if (d <= bestD) { bestD = d; best = f; }
		}
		return best;
	},

	playEcho(frag, gain = 0.5, pan = 0) {
		if (frag) this.audio.echo(frag, { gain, pan });
	},

	// --- hints: the only instructions the game gives, each shown twice at most, ever ---
	hint(key, text) {
		const counts = store.get(KEYS.HINTS, {});
		if ((counts[key] || 0) >= 2) return;
		counts[key] = (counts[key] || 0) + 1;
		store.set(KEYS.HINTS, counts);
		hintNode.textContent = text;
		hintNode.classList.add('shown');
		clearTimeout(this.hintTimer);
		this.hintTimer = setTimeout(() => this.clearHint(), 9000);
	},
	// Said every time it is needed, unlike a hint: used when a press was let go too early.
	say(text) {
		hintNode.textContent = text;
		hintNode.classList.add('shown');
		clearTimeout(this.hintTimer);
		this.hintTimer = setTimeout(() => this.clearHint(), 5000);
	},
	clearHint() {
		clearTimeout(this.hintTimer);
		hintNode.classList.remove('shown');
	},

	autosave() {
		if (this.run) store.set(KEYS.RUN, this.run);
	},

	// Something in the run changed: redraw what depends on it, and save.
	changed() {
		this.inventory.renderSky();
		this.inventory.renderHandsButton();
		this.updateLight();
		this.autosave();
	},

	updateLight() {
		this.target = lightState(lightOf(this.run));
		root.style.setProperty('--anchor', this.target.anchor.toFixed(3));
	},

	// --- gathering ---
	pickUp(f) {
		const run = this.run;
		if (run.hand.length >= CONFIG.HAND_MAX) {
			const hands = $('#hands');
			hands.classList.remove('full');
			void hands.offsetWidth;
			hands.classList.add('full');
			this.hint('full', 'your hands are full');
			return false;
		}
		const i = run.shore.indexOf(f);
		if (i < 0) return false;
		run.shore.splice(i, 1);
		run.hand.push(f.id);
		this.playEcho(this.lib.get(f.id), 0.7);
		this.changed();
		this.hint('held', COARSE ? 'touch the lights below to see what you hold' : 'e, or the lights below · see what you hold');
		return true;
	},

	// --- fixing a detail ---
	answer(fragId, question, text) {
		const run = this.run;
		if (this.phase !== 'shore' || run.certaintyLeft <= 0) return;
		if (this.answerOf(fragId, question.id) !== undefined) return;	// permanent: never re-answered
		spend(run, costOf(question));
		(run.answers[fragId] ||= {})[question.id] = text;
		this.changed();
		if (run.certaintyLeft <= 0) this.beginEnding();
	},

	openMemory(index) { this.memory.open(index); },

	// --- the stopping itself ---
	async beginEnding() {
		if (this.phase !== 'shore') return;
		this.phase = 'ending';
		this.run.phase = 'ending';
		this.autosave();
		this.moving = false;
		walkTarget = null;
		await this.wait(2600);
		this.memory.close();
		this.inventory.close();
		this.inventory.renderHandsButton();
		this.clearHint();
		this.env.fadeTo(0, 7 / SPEED);
		this.audio.setBedLevel(0.5);
		await this.wait(8200);
		root.classList.add('sky-gone');
		await this.wait(2400);
		this.toReading();
	},

	toReading() {
		this.phase = 'reading';
		this.run.phase = 'reading';
		this.autosave();
		root.classList.add('sky-gone');
		this.reading.begin();
	},

	toRating() {
		this.phase = 'rating';
		this.run.phase = 'rating';
		this.autosave();
		this.rating.begin(this.run.point);
	},

	toSymbol(point) {
		this.phase = 'symbol';
		this.run.point = point;
		this.run.phase = 'symbol';
		this.autosave();
		this.symbol.begin();
	},

	finish(layers) {
		saveToGallery(layers, this.run.point);
		store.remove(KEYS.RUN);
		this.run = null;
		this.phase = 'gallery';
		this.inventory.renderSky();
		this.gallery.open(true);
	},

	toTitle() {
		this.phase = 'title';
		refreshTitle();
		showScreen('title', true);
		this.audio.setBedLevel(0.35);
	},
};

const COARSE = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
let walkTarget = null;		// { x, pick } set by click or touch
const keys = new Set();
let echoIn = 2;				// seconds until the shore next lets a fragment be heard
let gutter = null;			// { every, timer } once nothing is left to gather or answer
let saveIn = 5;

// === RUNS ===

function newRun() {
	const seed = FIXED_SEED !== null ? FIXED_SEED : randomSeed();
	const rand = makeRng(seed);
	const certainty = rollCertainty(rand);
	const pool = drawPool(game.list, rand);
	return {
		v: 1,
		seed,
		certaintyStart: certainty,
		certaintyLeft: certainty,
		playerX: CONFIG.WORLD_WIDTH / 2,
		shore: scatter(pool, rand),
		hand: [],
		containers: [],		// portraits: [{ x, y, fragments: [id], layout: { id: { x, y, s, r } }, caption, set }]
		answers: {},		// fragId -> { questionId: text }
		phase: 'shore',
		point: null,
	};
}

// A saved run survives edits to the library: fragments that no longer exist are dropped.
function loadRun() {
	const run = store.get(KEYS.RUN, null);
	if (!run || run.v !== 1 || !Array.isArray(run.shore) || !Array.isArray(run.containers)) return null;
	const known = (id) => game.lib.has(id);
	run.shore = run.shore.filter((f) => f && known(f.id));
	run.hand = (run.hand || []).filter(known);
	for (const c of run.containers) {
		c.fragments = (c.fragments || []).filter(known);
		normalisePortrait(c);
	}
	run.answers = run.answers || {};
	run.playerX = clamp(Number(run.playerX) || CONFIG.WORLD_WIDTH / 2, 60, CONFIG.WORLD_WIDTH - 60);
	return run;
}

function enterRun(run) {
	game.run = run;
	game.overlay = null;
	gutter = null;
	walkTarget = null;
	echoIn = 2.5;
	showScreen('title', false);
	root.classList.remove('sky-gone');
	game.audio.start();
	game.audio.setBedLevel(1);
	game.inventory.renderSky();
	game.updateLight();
	// Start the light where it belongs, so a resumed run does not replay its darkening.
	Object.assign(game.env, { light: game.target.light, ambient: game.target.ambient, farWater: game.target.farWater, warmth: game.target.warmth });

	if (run.phase !== 'shore') {
		// The light had already gone out. Return to the reading.
		game.env.fadeTo(0, 0);
		game.toReading();
		return;
	}
	game.phase = 'shore';
	game.env.fade = 0;
	game.env.fadeTo(1, 5 / SPEED);
	game.inventory.renderHandsButton();
	game.autosave();
	game.wait(2500).then(() => {
		if (game.phase === 'shore') game.hint('walk', COARSE ? 'touch the shore to walk · touch a light to gather it' : '← → walk · space gather');
	});
	if (run.certaintyLeft <= 0) game.beginEnding();
}

// === TITLE ===

function refreshTitle() {
	const saved = loadRun();
	$('#btn-continue').hidden = !saved;
	$('#btn-begin').hidden = !!saved;
	$('#btn-again').hidden = !saved;
	$('#btn-gallery').hidden = loadGallery().length === 0;
	const first = [...document.querySelectorAll('.title-menu .menu-item')].find((b) => !b.hidden);
	if (first) first.focus({ preventScroll: true });
}

function bindTitle() {
	$('#btn-begin').addEventListener('click', () => enterRun(newRun()));
	$('#btn-continue').addEventListener('click', () => {
		const saved = loadRun();
		enterRun(saved || newRun());
	});
	// Beginning again lets go of the run in progress, so it takes the same held press as an answer.
	holdToConfirm($('#btn-again'), () => 1200 / SPEED, () => enterRun(newRun()), null, () => game.say('keep it held down to let the last one go'));
	$('#btn-gallery').addEventListener('click', () => {
		showScreen('title', false);
		game.phase = 'gallery';
		game.audio.start();
		game.audio.setBedLevel(0.35);
		game.gallery.open(false);
	});
}

// === INPUT ===

function onKeyDown(e) {
	const typing = (e.target instanceof HTMLInputElement && e.target.type !== 'range') || e.target instanceof HTMLTextAreaElement;
	if (typing) return;
	const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
	if (key === 'm' && !e.ctrlKey && !e.metaKey) {
		muted = !muted;
		game.audio.setMuted(muted);
		return;
	}
	if (game.phase !== 'shore') return;

	if (game.overlay) {
		if (key === 'Escape' || (key === 'e' && game.overlay === 'hand')) {
			if (game.overlay === 'hand') game.inventory.close(); else game.memory.close();
			if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
			e.preventDefault();
		}
		return;
	}
	if (key === 'ArrowLeft' || key === 'a' || key === 'ArrowRight' || key === 'd') {
		keys.add(key === 'a' ? 'ArrowLeft' : key === 'd' ? 'ArrowRight' : key);
		walkTarget = null;
		e.preventDefault();
		return;
	}
	const onButton = document.activeElement instanceof HTMLButtonElement;
	if (key === ' ' || (key === 'Enter' && !onButton)) {
		// Space always gathers on the shore; Enter still presses whatever has focus.
		if (onButton) document.activeElement.blur();
		e.preventDefault();
		const f = game.nearestInReach();
		if (f) game.pickUp(f);
		return;
	}
	if (key === 'e' || key === 'ArrowUp') {
		e.preventDefault();
		game.inventory.open();
	}
}

function onKeyUp(e) {
	const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
	keys.delete(key === 'a' ? 'ArrowLeft' : key === 'd' ? 'ArrowRight' : key);
}

function onShorePointer(e) {
	game.audio.start();
	if (game.phase !== 'shore' || game.overlay) return;
	const run = game.run;
	const f = game.env.fragmentAt(e.clientX, e.clientY, run);
	if (f) {
		if (Math.abs(f.x - run.playerX) <= CONFIG.REACH) { game.pickUp(f); return; }
		walkTarget = { x: f.x, pick: f.id };
	} else {
		walkTarget = { x: clamp(game.env.wx(e.clientX, run.playerX), 60, CONFIG.WORLD_WIDTH - 60), pick: null };
	}
}

let muted = false;

// === THE LOOP ===

function update(dt) {
	const run = game.run;
	game.env.step(dt * SPEED, game.target);
	if (!run || game.phase !== 'shore') { game.moving = false; return; }

	// Walking. Nothing moves while something is being looked at.
	let dir = 0;
	if (!game.overlay) {
		if (keys.has('ArrowLeft')) dir -= 1;
		if (keys.has('ArrowRight')) dir += 1;
		if (dir === 0 && walkTarget) {
			const dx = walkTarget.x - run.playerX;
			if (Math.abs(dx) < 5) {
				const pick = walkTarget.pick;
				walkTarget = null;
				const f = pick && run.shore.find((s) => s.id === pick);
				if (f && Math.abs(f.x - run.playerX) <= CONFIG.REACH) game.pickUp(f);
			} else {
				dir = Math.sign(dx);
			}
		}
	}
	game.moving = dir !== 0;
	if (dir !== 0) {
		const step = dir * CONFIG.WALK_SPEED * SPEED * dt;
		if (walkTarget && Math.abs(walkTarget.x - run.playerX) < Math.abs(step)) run.playerX = walkTarget.x;
		else run.playerX = clamp(run.playerX + step, 60, CONFIG.WORLD_WIDTH - 60);
	}

	// Fragments are heard before they are seen: one at a time, the nearer the likelier and the louder.
	echoIn -= dt;
	if (echoIn <= 0) {
		const near = [];
		let total = 0;
		for (const f of run.shore) {
			const dx = f.x - run.playerX;
			const w = 1 - Math.abs(dx) / CONFIG.HEAR_RADIUS;
			if (w <= 0) continue;
			near.push({ f, dx, w: w * w });
			total += w * w;
		}
		echoIn = 1.2;
		if (near.length) {
			let pick = Math.random() * total;
			let chosen = near[0];
			for (const n of near) { pick -= n.w; if (pick <= 0) { chosen = n; break; } }
			const loud = Math.sqrt(chosen.w);
			const dur = game.audio.echo(game.lib.get(chosen.f.id), {
				gain: 0.08 + 0.42 * loud * loud,
				pan: clamp(chosen.dx / CONFIG.HEAR_RADIUS * 1.4, -1, 1),
			});
			echoIn = (dur || 2) + 1.8 + Math.random() * 3.2;
		}
	}

	// When there is nothing left to gather and nothing left to ask, the light goes out by itself.
	if (run.certaintyLeft > 0 && nothingLeftToFix(run)) {
		if (!gutter) gutter = { every: CONFIG.GUTTER_SECONDS / run.certaintyLeft, timer: 0 };
		gutter.timer += dt * SPEED;
		if (gutter.timer >= gutter.every) {
			gutter.timer = 0;
			spend(run, 1);
			game.changed();
			if (run.certaintyLeft <= 0) game.beginEnding();
		}
	} else {
		gutter = null;
	}

	saveIn -= dt;
	if (saveIn <= 0) { saveIn = 5; game.autosave(); }
}

function nothingLeftToFix(run) {
	if (run.shore.length > 0 || run.hand.length > 0) return false;
	for (const c of run.containers) {
		// An open portrait is still being made: the light waits for it.
		if (!c.set && c.fragments.length) return false;
		for (const id of c.fragments) {
			const frag = game.lib.get(id);
			if (frag && frag.questions.some((q) => game.answerOf(id, q.id) === undefined)) return false;
		}
	}
	return true;
}

let last = performance.now();
function frame(now) {
	const dt = Math.min(0.1, (now - last) / 1000);
	last = now;
	update(dt);
	game.env.draw(game, now / 1000);
	if (DEBUG) drawDebug();
	requestAnimationFrame(frame);
}

// === DEBUG ===

function drawDebug() {
	const run = game.run;
	$('#debug').textContent = run
		? `certainty ${run.certaintyLeft}/${run.certaintyStart}  seed ${run.seed}  x ${Math.round(run.playerX)}\n`
			+ `shore ${run.shore.length}  hand ${run.hand.join(' ')}  portraits ${run.containers.map((c) => c.fragments.length + (c.set ? '*' : '')).join(',')}\n`
			+ `phase ${game.phase}  overlay ${game.overlay}  near ${(game.nearestInReach() || {}).id || '-'}`
		: `phase ${game.phase}`;
}

function installDebug() {
	$('#debug').hidden = false;
	if (SPEED > 1) root.classList.add('fast');
	window.__adrift = {
		game,
		state: () => ({
			phase: game.phase,
			overlay: game.overlay,
			run: game.run ? JSON.parse(JSON.stringify(game.run)) : null,
			light: game.run ? lightOf(game.run) : null,
			env: { ambient: game.env.ambient, farWater: game.env.farWater, warmth: game.env.warmth, fade: game.env.fade },
			gallery: loadGallery().length,
			persistent: store.persistent,
			audio: game.audio.started,
		}),
		spend(n) {
			spend(game.run, n);
			game.changed();
			if (game.run.certaintyLeft <= 0) game.beginEnding();
		},
		setLight(share) {
			game.run.certaintyLeft = Math.round(game.run.certaintyStart * share);
			game.changed();
		},
		teleport(x) { game.run.playerX = x; },
	};
}

// === BOOT ===

async function boot() {
	game.inventory = new Inventory(game);
	game.memory = new MemoryView(game);
	game.reading = new Reading(game);
	game.rating = new RatingChart(game);
	game.symbol = new SymbolBuilder(game);
	game.gallery = new Gallery(game);

	try {
		game.list = await loadFragments();
	} catch (err) {
		// Opened from the file system, most likely: browsers will not fetch JSON from file://.
		$('#title .title-menu').textContent = 'this needs a web server · see the readme';
		console.error('adrift: could not load fragments', err);
		return;
	}
	for (const f of game.list) game.lib.set(f.id, f);

	bindTitle();
	refreshTitle();
	document.addEventListener('keydown', onKeyDown);
	document.addEventListener('keyup', onKeyUp);
	window.addEventListener('blur', () => keys.clear());
	$('#shore').addEventListener('pointerdown', onShorePointer);
	window.addEventListener('resize', () => game.env.resize());
	document.addEventListener('visibilitychange', () => { if (document.hidden) game.autosave(); });
	window.addEventListener('pagehide', () => game.autosave());
	if (DEBUG) installDebug();
	requestAnimationFrame(frame);
	console.log('adrift: boot ok');
}

boot();
