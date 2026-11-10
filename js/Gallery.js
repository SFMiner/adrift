// The gallery: every finished run, as its symbol at its point on the plane. No text, no summary.
import { store, KEYS } from './Save.js';
import { renderSymbol } from './SymbolBuilder.js';
import { $, el, showScreen } from './ui.js';

const MAX_RUNS = 400;

export function loadGallery() {
	const list = store.get(KEYS.GALLERY, []);
	return Array.isArray(list) ? list.filter((r) => r && r.point && Array.isArray(r.symbol)) : [];
}

export function saveToGallery(symbol, point) {
	const list = loadGallery();
	list.push({ symbol, point, t: Date.now() });
	store.set(KEYS.GALLERY, list.slice(-MAX_RUNS));
	return list.length;
}

export class Gallery {
	constructor(game) {
		this.game = game;
		this.plane = $('#gallery-plane');
		$('#gallery-close').addEventListener('click', () => this.close());
	}

	open(highlightLast = false) {
		const runs = loadGallery();
		this.plane.replaceChildren();
		runs.forEach((run, i) => {
			const mark = el('div', 'mark');
			mark.style.left = (run.point.x * 100) + '%';
			mark.style.top = (run.point.y * 100) + '%';
			mark.tabIndex = 0;
			mark.setAttribute('role', 'img');
			mark.setAttribute('aria-label', 'A life');
			renderSymbol(mark, run.symbol);
			if (highlightLast && i === runs.length - 1) mark.classList.add('newest');
			this.plane.append(mark);
		});
		showScreen('gallery', true);
		$('#gallery-close').focus({ preventScroll: true });
	}

	close() {
		showScreen('gallery', false);
		this.game.toTitle();
	}
}
