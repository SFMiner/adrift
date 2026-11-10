// node tests/web/shots.cjs [rootDir]
// Screenshots of every screen and every light level, for a person (or Claude) to look at.
// Output: tests/web/shots/*.png
const path = require('node:path');
const fs = require('node:fs');
const { serve, loadPlaywright } = require('./server.cjs');

const SIZES = { desktop: [1366, 768], frame: [1180, 500], phone: [390, 780] };

(async () => {
	const root = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
	const out = path.join(__dirname, 'shots');
	fs.mkdirSync(out, { recursive: true });
	const { server, url } = await serve(root);
	const { chromium } = loadPlaywright();
	const browser = await chromium.launch({ channel: 'chrome' });
	const only = process.env.SHOT_SIZE;
	for (const [name, [width, height]] of Object.entries(SIZES)) {
		if (only && only !== name) continue;
		const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: name === 'phone' ? 2 : 1.5, hasTouch: name === 'phone' });
		const page = await ctx.newPage();
		page.on('console', (m) => { if (m.type() === 'error') console.log(`[${name}] console error:`, m.text()); });
		page.on('pageerror', (e) => console.log(`[${name}] page error:`, e.message));
		const shot = (label) => page.screenshot({ path: path.join(out, `${name}-${label}.png`) });
		const settle = (ms = 900) => page.waitForTimeout(ms);

		await page.goto(`${url}/index.html?debug=1&seed=7&speed=6`);
		await page.waitForFunction(() => window.__adrift);
		await settle();
		await shot('01-title');
		await page.click('#btn-begin');
		await settle(2200);
		// Stand beside a fragment so its words surface.
		await page.evaluate(() => { const a = window.__adrift; a.teleport(a.game.run.shore[12].x - 60); });
		await settle(600);
		await shot('02-shore-full');

		// Gather five, keep three in two memories, answer one question.
		await page.evaluate(() => {
			const g = window.__adrift.game;
			for (let i = 0; i < 5; i++) g.pickUp(g.run.shore[10]);
		});
		await page.keyboard.press('e');
		await settle();
		await shot('03-hand');
		await page.click('#cards .card >> nth=0');
		await settle(500);
		await shot('04-hand-lifted');
		await page.mouse.click(width * 0.3, height * 0.2);
		await settle(500);
		await page.click('#cards .card >> nth=0');
		await page.click('.constellation >> nth=0');
		await settle(400);
		await page.click('#cards .card >> nth=0');
		await page.mouse.click(width * 0.7, height * 0.16);
		await settle(600);
		await page.keyboard.press('Escape');
		await settle(500);
		await shot('05-shore-memories');
		await page.click('.constellation >> nth=0');
		await settle();
		await page.click('#memory .prompt >> nth=0');
		await settle(400);
		await shot('06-memory');
		const answer = page.locator('#memory .answer').first();
		const box = await answer.boundingBox();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await settle(500);
		await page.mouse.up();
		await settle(600);
		await shot('07-memory-answered');
		await page.keyboard.press('Escape');

		for (const share of [0.5, 0.25, 0.08]) {
			await page.evaluate((s) => window.__adrift.setLight(s), share);
			await settle(2600);
			await shot(`08-light-${String(Math.round(share * 100)).padStart(2, '0')}`);
		}
		await page.evaluate(() => window.__adrift.spend(99));
		await page.waitForSelector('#reading.active', { timeout: 20000 });
		await settle(700);
		await shot('09-reading');
		for (let i = 0; i < 6 && !(await page.locator('#rating.active').count()); i++) {
			await page.click('#reading-next');
			await settle(500);
		}
		await page.click('.axis-prompt >> nth=0');
		await page.click('.axis-prompt >> nth=2');
		const plane = await page.locator('#plane').boundingBox();
		await page.mouse.click(plane.x + plane.width * 0.68, plane.y + plane.height * 0.3);
		await settle(400);
		await shot('10-rating');
		await page.click('#rating-next');
		await settle(500);
		for (const n of [12, 13, 16, 0]) await page.click(`.palette-item >> nth=${n}`);
		await page.fill('#ctl-size', '0.8');
		await settle(400);
		await shot('11-symbol');
		await page.click('#symbol-next');
		await settle(900);
		await shot('12-gallery');
		await ctx.close();
	}
	await browser.close();
	server.close();
	console.log('shots written to', out);
})().catch((e) => { console.error(e); process.exit(1); });
