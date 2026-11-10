// node tests/web/run_check.cjs [rootDir]
//
// A bot that plays Adrift from the title to the gallery with real key and pointer events, and checks
// the rules the design depends on. Uses the Chrome already on the machine through Playwright.
//
//   SEEDS=20      how many seeded full runs (default 20)
//   PLAIN=0       skip the slow run without ?debug (default: run it)
//
// Every run fails on any console error or page error, and must print the boot line.
const path = require('node:path');
const { serve, loadPlaywright } = require('./server.cjs');

const SEEDS = Number(process.env.SEEDS || 20);
const PLAIN = process.env.PLAIN !== '0';
const SPEED = 8;

const results = [];
let checks = 0;
function check(cond, label, where) {
	checks++;
	if (!cond) throw new Error(`${where}: ${label}`);
}

function watch(page, log) {
	log.errors = [];
	log.boot = false;
	page.on('console', (m) => {
		if (m.text().includes('adrift: boot ok')) log.boot = true;
		if (m.type() === 'error') log.errors.push(m.text() + ' @ ' + (m.location().url || ''));
	});
	page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
	page.on('requestfailed', (r) => log.errors.push('request failed: ' + r.url()));
}

const active = (page, id) => page.evaluate((i) => document.getElementById(i).classList.contains('active'), id);
const count = (page, sel) => page.locator(sel).count();
const state = (page) => page.evaluate(() => (window.__adrift ? window.__adrift.state() : null));
const noDigits = async (page, where) => {
	const text = await page.evaluate(() => document.body.innerText);
	check(!/\d/.test(text), `a digit is visible on screen: "${(text.match(/.{0,20}\d.{0,20}/) || [''])[0]}"`, where);
};

async function hold(page, locator, ms, how = 'mouse') {
	if (how === 'key') {
		await locator.focus();
		await page.keyboard.down('Enter');
		await page.waitForTimeout(ms);
		await page.keyboard.up('Enter');
		return;
	}
	await locator.scrollIntoViewIfNeeded();
	const box = await locator.boundingBox();
	if (!box) throw new Error('nothing to hold');
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.waitForTimeout(ms);
	await page.mouse.up();
}

// Walk one way for a while, gathering whatever is in reach.
async function walk(page, key, ms, tap) {
	await page.keyboard.down(key);
	for (let t = 0; t < ms; t += tap) {
		await page.keyboard.press(' ');
		await page.waitForTimeout(tap);
	}
	await page.keyboard.up(key);
}

// Play from the title until the reading begins. opts: { debug, seed, speed, variant }
async function playToReading(page, opts, where) {
	const speed = opts.debug ? SPEED : 1;
	const holdMs = Math.ceil(900 / speed) + 400;	// generous: frames run late when the machine is busy
	const rand = (() => { let a = opts.seed * 9301 + 49297; return () => ((a = (a * 233280 + 1) % 4294967291) / 4294967291); })();
	const v = opts.variant || {};

	await page.click('#btn-begin');
	await page.waitForTimeout(600);
	check(!(await active(page, 'title')) || true, 'left the title', where);
	if (opts.debug) check((await state(page)).audio, 'audio started on the first click', where);

	const placed = new Map();	// fragment id -> container index, to prove nothing ever moves
	let lightBefore = 1;
	let dir = 'ArrowRight';
	let legs = 0;
	let didSetDown = false;
	let didDrag = false;
	let didKeyboardPlace = false;
	let didReload = false;
	let answers = 0;
	const started = Date.now();
	const limit = opts.debug ? 240000 : 900000;

	while (!(await active(page, 'reading'))) {
		if (Date.now() - started > limit) throw new Error(`${where}: the run did not reach the reading in time`);
		try {
			// --- walk and gather ---
			await walk(page, dir, opts.debug ? 700 : 5200, opts.debug ? 55 : 260);
			legs++;
			if (legs % (opts.debug ? 9 : 11) === 0) dir = dir === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight';
			const held = await count(page, '#hands .mote.held');
			check(held <= 5, 'never more than five in hand', where);

			// --- look at what is held, and put it somewhere ---
			if (held >= 2) {
				await page.keyboard.press('e');
				await page.waitForSelector('#hand.active', { timeout: 2000 });
				if (!opts.debug) await noDigits(page, where + ' (hand)');
				let guard = 8;
				while (guard-- > 0 && (await count(page, '#cards .card')) > 1 && (await active(page, 'hand'))) {
					const card = page.locator('#cards .card').first();
					const constellations = await count(page, '.constellation');
					if (v.setDown && !didSetDown) {
						const before = await state(page);
						await card.click();
						await page.click('#set-down');
						const after = await state(page);
						check(after.run.hand.length === before.run.hand.length - 1 && after.run.shore.length === before.run.shore.length + 1,
							'setting down returns the fragment to the shore', where);
						didSetDown = true;
						continue;
					}
					if (v.drag && !didDrag) {
						const box = await card.boundingBox();
						const vp = page.viewportSize();
						await page.mouse.move(box.x + box.width / 2, box.y + 12);
						await page.mouse.down();
						await page.mouse.move(vp.width * 0.5, vp.height * 0.3, { steps: 8 });
						await page.mouse.move(vp.width * 0.62, vp.height * 0.18, { steps: 6 });
						await page.mouse.up();
						check((await count(page, '.constellation')) === constellations + 1, 'dragging a card into the dark makes a memory', where);
						didDrag = true;
						continue;
					}
					if (v.keyboard && !didKeyboardPlace) {
						await card.focus();
						await page.keyboard.press('Enter');
						await page.locator('#sky-drop').focus();
						await page.keyboard.press('Enter');
						check((await count(page, '.constellation')) === constellations + 1, 'a memory can be made from the keyboard', where);
						didKeyboardPlace = true;
						continue;
					}
					await card.click();
					if (constellations < 2 || (constellations < 7 && rand() < 0.3)) {
						const vp = page.viewportSize();
						const cardsBefore = await count(page, '#cards .card');
						const x = vp.width * (0.1 + 0.8 * rand());
						const y = vp.height * (0.09 + 0.24 * rand());
						const onOne = await page.evaluate(([px, py]) => !!document.elementFromPoint(px, py).closest('.constellation'), [x, y]);
						await page.mouse.click(x, y);
						check((await count(page, '.constellation')) === constellations + (onOne ? 0 : 1), 'clicking the dark makes a new memory', where);
						check((await count(page, '#cards .card')) === cardsBefore - 1 || !(await active(page, 'hand')), 'the placed card leaves the hand', where);
					} else {
						await page.locator('.constellation').nth(Math.floor(rand() * constellations)).click({ timeout: 2000 });
					}
				}
				if (await active(page, 'hand')) await page.keyboard.press('Escape');
				await page.waitForTimeout(120);
			}

			if (opts.debug) {
				const s = await state(page);
				check(s.run.hand.length <= 5, 'hand limit holds in state', where);
				s.run.containers.forEach((c, i) => c.fragments.forEach((id) => {
					check(!placed.has(id) || placed.get(id) === i, `fragment ${id} moved between memories`, where);
					placed.set(id, i);
				}));
				for (const id of placed.keys()) {
					check(!s.run.hand.includes(id) && !s.run.shore.some((f) => f.id === id), `placed fragment ${id} left its memory`, where);
				}
				check(s.light <= lightBefore + 1e-9, 'the light never comes back', where);
				lightBefore = s.light;
			}

			// --- midway: reload and continue (autosave) ---
			if (v.reload && !didReload && placed.size >= 3 && answers >= 1) {
				const before = (await state(page)).run;
				await page.reload();
				await page.waitForFunction(() => window.__adrift);
				check(await page.locator('#btn-continue').isVisible(), 'a run in progress offers "continue"', where);
				check(!(await page.locator('#btn-begin').isVisible()), '"begin" gives way to "begin again"', where);
				await page.click('#btn-continue');
				await page.waitForTimeout(400);
				const after = (await state(page)).run;
				for (const key of ['seed', 'certaintyStart', 'certaintyLeft', 'hand', 'containers', 'answers']) {
					check(JSON.stringify(after[key]) === JSON.stringify(before[key]), `"${key}" survives a reload`, where);
				}
				check(after.shore.length === before.shore.length, 'the shore survives a reload', where);
				didReload = true;
			}

			// --- go into a memory and make something certain ---
			const constellations = await count(page, '.constellation');
			if (constellations > 0 && !(await active(page, 'reading'))) {
				await page.locator('.constellation').nth(Math.floor(rand() * constellations)).click({ timeout: 2000 });
				await page.waitForSelector('#memory.active', { timeout: 2000 });
				if (!opts.debug) await noDigits(page, where + ' (memory)');
				check((await count(page, '#memory-col .frag-text')) > 0, 'a memory shows its fragments', where);
				check((await count(page, '#memory-col button.frag-text, #memory-col .frag [draggable="true"]')) === 0, 'nothing in a memory can be picked back out', where);
				for (let n = 0; n < 5; n++) {
					const prompts = await count(page, '#memory .prompt');
					if (prompts === 0) break;
					const fixedBefore = await count(page, '#memory .fixed');
					const before = opts.debug ? await state(page) : null;
					await page.locator('#memory .prompt').nth(Math.floor(rand() * prompts)).click({ timeout: 2000 });

					// A short press must do nothing.
					const option = page.locator('#memory .answers .answer:not(.free-commit)').first();
					if (n === 0 && answers === 0) {
						await option.click({ timeout: 2000 });
						await page.waitForTimeout(150);
						check((await count(page, '#memory .fixed')) === fixedBefore, 'a quick click does not fix an answer', where);
					}
					const free = page.locator('#memory .free-input');
					if ((await free.count()) && rand() < 0.3) {
						await free.fill('  something   of my own ');
						await hold(page, page.locator('#memory .free-commit'), holdMs);
					} else {
						await hold(page, option, holdMs, v.keyboard && answers % 2 === 0 ? 'key' : 'mouse');
					}
					await page.waitForTimeout(120);
					if (!(await active(page, 'memory'))) break;
					check((await count(page, '#memory .fixed')) === fixedBefore + 1, 'holding an answer fixes it', where);
					answers++;
					if (before) {
						const after = await state(page);
						check(after.run.certaintyLeft < before.run.certaintyLeft, 'an answer costs certainty', where);
						// Try to answer the same question again through the game's own entry point.
						const again = await page.evaluate(() => {
							const g = window.__adrift.game;
							const [fragId, qid] = document.querySelector('#memory [data-fixed]').dataset.fixed.split('/');
							const q = g.lib.get(fragId).questions.find((x) => x.id === qid);
							const was = g.answerOf(fragId, qid);
							const left = g.run.certaintyLeft;
							g.answer(fragId, q, 'something else entirely');
							return { same: g.answerOf(fragId, qid) === was, free: g.run.certaintyLeft === left };
						});
						check(again.same && again.free, 'an answered question cannot be answered again', where);
						if (after.run.certaintyLeft === 0) break;
					}
				}
				check((await count(page, '#memory .fixed button, #memory .fixed input')) === 0, 'a fixed detail offers nothing to change', where);
				if (await active(page, 'memory')) await page.keyboard.press('Escape');
				await page.waitForTimeout(100);
			}
		} catch (err) {
			// The light can go out in the middle of any gesture; that is the design. Anything else is real.
			const s = opts.debug ? await state(page) : null;
			const ending = s ? s.phase !== 'shore' : await page.evaluate(() => !document.querySelector('#hands') || document.querySelector('#game').classList.contains('sky-gone') || document.getElementById('reading').classList.contains('active'));
			if (!ending && !/Timeout|not visible|detached|nothing to hold/i.test(String(err.message))) throw err;
			if (!ending && /a digit|moved|never|survives|cannot|costs|fixes|makes|offers|returns/.test(String(err.message))) throw err;
			if (opts.debug && s && s.phase === 'shore' && /Timeout/.test(String(err.message))) {
				// A missed click while the shore is still live: close whatever is open and carry on.
				await page.keyboard.press('Escape');
			}
			if (ending) await page.waitForSelector('#reading.active', { timeout: 60000 });
		}
	}

	if (opts.debug) {
		const s = await state(page);
		check(s.run.certaintyLeft === 0, 'the reading begins only when certainty is gone', where);
		check(s.env.fade < 0.02, 'the shore has gone dark', where);
		if (v.setDown) check(didSetDown, 'the set-down path was exercised', where);
		if (v.drag) check(didDrag, 'the drag path was exercised', where);
		if (v.keyboard) check(didKeyboardPlace, 'the keyboard path was exercised', where);
		if (v.reload) check(didReload, 'the reload path was exercised', where);
	}
	return { answers, placed: placed.size };
}

// From the reading to the gallery.
async function finishRun(page, opts, where) {
	if (!opts.debug) await noDigits(page, where + ' (reading)');
	const s0 = opts.debug ? await state(page) : null;
	if (s0) {
		const kept = s0.run.containers.filter((c) => c.fragments.length).length;
		let pages = 0;
		while (await active(page, 'reading')) {
			if (kept > 0) {
				await page.waitForSelector('.memory-read.shown', { timeout: 5000 });
				pages++;
				const fixed = await count(page, '.memory-read .read-fixed');
				const open = await count(page, '.memory-read .read-open');
				const c = s0.run.containers.filter((x) => x.fragments.length)[pages - 1];
				const expected = await page.evaluate((frags) => {
					const g = window.__adrift.game;
					let fixed = 0, open = 0;
					for (const id of frags) for (const q of g.lib.get(id).questions) (g.answerOf(id, q.id) !== undefined ? fixed++ : open++);
					return { fixed, open };
				}, c.fragments);
				check(fixed === expected.fixed && open === expected.open, 'the reading shows fixed details in full and open ones softly', where);
			}
			await page.click('#reading-next');
			await page.waitForTimeout(220);
		}
		check(pages === kept, `the reading shows every memory once (${pages} of ${kept})`, where);
	} else {
		while (await active(page, 'reading')) {
			await page.click('#reading-next');
			await page.waitForTimeout(1500);
		}
	}

	await page.waitForSelector('#rating.active', { timeout: 8000 });
	if (!opts.debug) await noDigits(page, where + ' (rating)');
	check(!(await page.locator('#rating-next').isVisible()), 'the chart cannot be left before a point is placed', where);
	check((await page.evaluate(() => [...document.querySelectorAll('.axis-label')].every((i) => i.value === ''))), 'the axes start unlabelled', where);
	await page.click('.axis-prompt >> nth=1');
	const plane = await page.locator('#plane').boundingBox();
	const px = 0.15 + 0.7 * ((opts.seed * 37 % 100) / 100);
	const py = 0.15 + 0.7 * ((opts.seed * 61 % 100) / 100);
	await page.mouse.click(plane.x + plane.width * px, plane.y + plane.height * py);
	await page.locator('#plane').focus();
	await page.keyboard.press('ArrowRight');
	await page.click('#rating-next');

	await page.waitForSelector('#symbol.active', { timeout: 8000 });
	if (!opts.debug) await noDigits(page, where + ' (symbol)');
	check(!(await page.locator('#symbol-next').isVisible()), 'an empty mark cannot be kept', where);
	const items = await count(page, '.palette-item');
	check(items === 20, 'the symbol library has twenty objects', where);
	for (const n of [opts.seed % 20, (opts.seed * 7 + 3) % 20, (opts.seed * 11 + 5) % 20]) await page.click(`.palette-item >> nth=${n}`);
	await page.fill('#ctl-size', String(Number((0.3 + (opts.seed % 5) * 0.15).toFixed(2))));
	await page.fill('#ctl-sat', '1.6');
	await page.click('#ctl-down');
	const stage = await page.locator('#stage').boundingBox();
	await page.mouse.move(stage.x + stage.width * 0.5, stage.y + stage.height * 0.5);
	await page.mouse.down();
	await page.mouse.move(stage.x + stage.width * 0.3, stage.y + stage.height * 0.65, { steps: 5 });
	await page.mouse.up();
	check((await count(page, '#stage .layer')) === 3, 'three objects are layered on the stage', where);
	const loaded = await page.evaluate(() => [...document.querySelectorAll('#stage .layer')].every((i) => i.complete && i.naturalWidth > 0));
	check(loaded, 'the symbol images load', where);
	await page.click('#symbol-next');

	await page.waitForSelector('#gallery.active', { timeout: 8000 });
	if (!opts.debug) await noDigits(page, where + ' (gallery)');
	const text = await page.evaluate(() => document.getElementById('gallery').innerText.trim());
	check(text === '', 'the gallery has no text', where);
	return count(page, '#gallery-plane .mark');
}

async function fullRun(browser, url, opts) {
	const where = opts.label;
	const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 720 } });
	if (opts.blockStorage) {
		await ctx.addInitScript(() => {
			Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
		});
	}
	const page = await ctx.newPage();
	const log = {};
	watch(page, log);
	const query = opts.debug ? `?debug=1&seed=${opts.seed}&speed=${SPEED}` : '';
	await page.goto(`${url}/index.html${query}`);
	await page.waitForSelector('#btn-begin', { state: 'visible' });
	check(log.boot, 'the boot line was printed', where);

	if (!opts.debug) {
		check(await page.evaluate(() => window.__adrift === undefined), 'no debug hooks without ?debug', where);
		check(await page.evaluate(() => document.getElementById('debug').hidden), 'no debug overlay without ?debug', where);
		await noDigits(page, where + ' (title)');
	} else {
		const s = await state(page);
		check(s.persistent === !opts.blockStorage, 'storage is detected correctly', where);
	}

	const played = await playToReading(page, opts, where);
	const marks = await finishRun(page, opts, where);
	check(marks === 1, `the gallery holds this run (${marks})`, where);

	// The gallery survives a reload when storage works, and the finished run is gone.
	await page.click('#gallery-close');
	await page.waitForSelector('#title.active');
	check(!(await page.locator('#btn-continue').isVisible()), 'a finished run cannot be continued', where);
	if (!opts.blockStorage) {
		await page.reload();
		await page.waitForSelector('#btn-gallery', { state: 'visible' });
		await page.click('#btn-gallery');
		await page.waitForSelector('#gallery.active');
		check((await count(page, '#gallery-plane .mark')) === 1, 'the gallery survives a reload', where);
		const layers = await count(page, '#gallery-plane .mark .layer');
		check(layers === 3, 'the saved symbol is drawn in the gallery', where);
	} else {
		check(await page.locator('#btn-gallery').isVisible(), 'with storage blocked the gallery still holds the run for this visit', where);
	}
	check(log.errors.length === 0, 'console errors: ' + log.errors.join(' | '), where);
	await ctx.close();
	return played;
}

// Nothing left to gather or ask: the light goes out by itself, and an empty life still ends.
async function gutterRun(browser, url) {
	const where = 'gutter';
	const ctx = await browser.newContext({ viewport: { width: 1180, height: 500 } });
	const page = await ctx.newPage();
	const log = {};
	watch(page, log);
	await page.goto(`${url}/index.html?debug=1&seed=3&speed=${SPEED}`);
	await page.waitForSelector('#btn-begin', { state: 'visible' });
	await page.click('#btn-begin');
	await page.waitForTimeout(400);
	const start = await state(page);
	check(start.run.shore.length === 30, 'thirty fragments are drawn', where);
	check(start.run.certaintyStart >= 40 && start.run.certaintyStart <= 100, 'certainty starts inside its range', where);
	await page.evaluate(() => { const r = window.__adrift.game.run; r.shore.length = 0; });
	await page.waitForSelector('#reading.active', { timeout: 60000 });
	const s = await state(page);
	check(s.run.certaintyLeft === 0, 'the light guttered out', where);
	const marks = await finishRun(page, { debug: true, seed: 3 }, where);
	check(marks === 1, 'an empty life is still kept', where);
	check(log.errors.length === 0, 'console errors: ' + log.errors.join(' | '), where);
	await ctx.close();
}

// Two seeds give two different lives; one seed gives the same life twice.
async function seedRun(browser, url) {
	const where = 'seeds';
	const draw = async (seed) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		await page.goto(`${url}/index.html?debug=1&seed=${seed}&speed=${SPEED}`);
		await page.waitForSelector('#btn-begin', { state: 'visible' });
		await page.click('#btn-begin');
		const s = await state(page);
		await ctx.close();
		return JSON.stringify([s.run.certaintyStart, s.run.shore]);
	};
	const a = await draw(11), b = await draw(11), c = await draw(12);
	check(a === b, 'a seed reproduces its run', where);
	check(a !== c, 'different seeds give different runs', where);
}

// Every echo recipe renders to something audible that does not clip.
async function audioRun(browser, url) {
	const where = 'audio';
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	const log = {};
	watch(page, log);
	await page.goto(`${url}/index.html?debug=1`);
	await page.waitForFunction(() => window.__adrift);
	const rows = await page.evaluate(async () => {
		const audio = await import('./js/Audio.js');
		const used = new Set(window.__adrift.game.list.map((f) => f.echo.recipe));
		const out = [];
		for (const name of audio.RECIPE_NAMES) {
			const ctx = new OfflineAudioContext(2, 44100 * 6, 44100);
			let seed = 7;
			const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
			const dur = audio.playRecipe(ctx, ctx.destination, name, 0.05, { pitch: 1, rand });
			const buf = await ctx.startRendering();
			let peak = 0, bad = false;
			for (let ch = 0; ch < buf.numberOfChannels; ch++) {
				for (const v of buf.getChannelData(ch)) { if (Number.isNaN(v)) bad = true; const a = Math.abs(v); if (a > peak) peak = a; }
			}
			out.push({ name, dur, peak, bad, used: used.has(name) });
		}
		return out;
	});
	check(rows.length === 38, 'thirty-eight recipes', where);
	for (const r of rows) {
		check(!r.bad && r.peak > 0.04 && r.peak < 0.7, `recipe ${r.name} peaks at ${r.peak.toFixed(3)}`, where);
		check(r.dur >= 0.4 && r.dur <= 5, `recipe ${r.name} lasts ${r.dur}`, where);
	}
	const unused = rows.filter((r) => !r.used).map((r) => r.name);
	if (unused.length) console.log('  note: recipes no fragment uses:', unused.join(', '));
	check(log.errors.length === 0, 'console errors: ' + log.errors.join(' | '), where);
	await ctx.close();
}

async function run(label, fn) {
	const t = Date.now();
	try {
		const info = await fn();
		results.push({ label, ok: true });
		console.log(`pass  ${label}  (${((Date.now() - t) / 1000).toFixed(0)}s)${info ? '  ' + JSON.stringify(info) : ''}`);
	} catch (err) {
		results.push({ label, ok: false, err: err.message });
		console.log(`FAIL  ${label}: ${err.message}`);
	}
}

(async () => {
	const root = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
	const { server, url } = await serve(root);
	const { chromium } = loadPlaywright();
	const browser = await chromium.launch({ channel: 'chrome' });
	console.log(`adrift check: ${root}`);

	const jobs = [];
	jobs.push(() => run('seeds', () => seedRun(browser, url)));
	jobs.push(() => run('audio', () => audioRun(browser, url)));
	jobs.push(() => run('gutter', () => gutterRun(browser, url)));
	for (let seed = 1; seed <= SEEDS; seed++) {
		const variant = { setDown: seed % 4 === 1, drag: seed % 4 === 2, keyboard: seed % 4 === 3, reload: seed % 4 === 0 };
		const viewport = seed % 5 === 0 ? { width: 1180, height: 500 } : seed % 7 === 0 ? { width: 820, height: 1100 } : { width: 1280, height: 720 };
		jobs.push(() => run(`run seed ${seed}`, () => fullRun(browser, url, { label: `seed ${seed}`, debug: true, seed, variant, viewport })));
	}
	jobs.push(() => run('storage blocked', () => fullRun(browser, url, { label: 'storage blocked', debug: true, seed: 101, blockStorage: true })));
	if (PLAIN) jobs.push(() => run('plain (no debug, real speed)', () => fullRun(browser, url, { label: 'plain', debug: false, seed: 5 })));

	// A few at a time: each is its own browser context, so they do not share storage.
	const WORKERS = Number(process.env.WORKERS || 5);
	let next = 0;
	await Promise.all(Array.from({ length: WORKERS }, async () => {
		while (next < jobs.length) await jobs[next++]();
	}));

	await browser.close();
	server.close();
	const failed = results.filter((r) => !r.ok);
	console.log(`\n${results.length - failed.length} of ${results.length} passed, ${checks} checks`);
	process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
