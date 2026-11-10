// A portrait: a frame holding fragments as pictures, arranged by the player, with a line saying how
// they belong together. Fragments go in one at a time and never leave. Once the portrait is set it can
// no longer be arranged, added to or re-captioned, and it shows in the sky as stars.
//
// The data lives in run.containers: { x, y, fragments: [id], layout: { id: { x, y, s, r } }, caption, set }
import { CONFIG } from './config.js';
import { hash01 } from './rng.js';
import { el, clamp } from './ui.js';

export const symbolSrc = (frag) => `assets/symbols/${(frag && frag.symbol) || CONFIG.SYMBOL_FALLBACK}.svg`;

// Where a newly kept fragment's picture first appears: loosely, never dead centre, and as far from the
// pictures already in the frame as a handful of tries allows. `taken` is the spots already in use.
export function spotFor(id, n, taken = []) {
	let best = null;
	let bestGap = -1;
	for (let k = 0; k < 14; k++) {
		const x = 0.18 + 0.64 * hash01(id + 'x' + n + ':' + k);
		const y = 0.18 + 0.64 * hash01(id + 'y' + n + ':' + k);
		let gap = Infinity;
		for (const t of taken) gap = Math.min(gap, Math.hypot(t.x - x, t.y - y));
		if (gap > bestGap) { bestGap = gap; best = { x, y }; }
		if (taken.length === 0) break;
	}
	return { x: Math.round(best.x * 1000) / 1000, y: Math.round(best.y * 1000) / 1000, s: CONFIG.PORTRAIT_SYMBOL_SIZE, r: 0 };
}

export function cleanCaption(raw) {
	return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, CONFIG.CAPTION_MAX);
}

// Bring a saved container up to date (runs saved before portraits existed have no layout).
export function normalisePortrait(c) {
	c.fragments = Array.isArray(c.fragments) ? c.fragments : [];
	const old = c.layout && typeof c.layout === 'object' ? c.layout : {};
	c.layout = {};
	c.fragments.forEach((id, i) => {
		const p = old[id];
		c.layout[id] = p && Number.isFinite(p.x) && Number.isFinite(p.y)
			? { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1), s: clamp(Number(p.s) || CONFIG.PORTRAIT_SYMBOL_SIZE, CONFIG.PORTRAIT_SYMBOL_MIN, CONFIG.PORTRAIT_SYMBOL_MAX), r: Number(p.r) || 0 }
			: spotFor(id, i, Object.values(c.layout));
	});
	c.caption = typeof c.caption === 'string' ? c.caption.slice(0, CONFIG.CAPTION_MAX) : '';
	c.set = c.set === true;
	return c;
}

export function styleSymbol(img, spot, share) {
	img.style.left = (spot.x * 100) + '%';
	img.style.top = (spot.y * 100) + '%';
	img.style.width = (spot.s * 100) + '%';
	img.style.transform = `translate(-50%, -50%) rotate(${spot.r || 0}deg)`;
	// The more of a fragment that has been made certain, the brighter its picture.
	img.style.filter = `brightness(${(0.62 + 0.5 * share).toFixed(2)})`;
	img.style.opacity = (0.72 + 0.28 * share).toFixed(2);
}

export function answeredShare(game, id) {
	const frag = game.lib.get(id);
	if (!frag || frag.questions.length === 0) return 0.3;
	return frag.questions.filter((q) => game.answerOf(id, q.id) !== undefined).length / frag.questions.length;
}

// Draw a portrait's pictures into any square element.
export function renderPortrait(node, container, game) {
	node.replaceChildren();
	for (const id of container.fragments) {
		const frag = game.lib.get(id);
		const spot = container.layout[id];
		if (!frag || !spot) continue;
		const img = el('img', 'sym');
		img.src = symbolSrc(frag);
		img.alt = '';
		img.draggable = false;
		img.dataset.id = id;
		styleSymbol(img, spot, answeredShare(game, id));
		node.append(img);
	}
}
