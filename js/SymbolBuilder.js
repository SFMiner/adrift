// The symbol: a mark assembled from a small library of objects. Objects can be layered, moved,
// scaled and turned. Colour control stops at brightness, contrast and saturation on purpose.
import { CONFIG } from './config.js';
import { $, el, clamp, showScreen } from './ui.js';

const srcOf = (id) => `assets/symbols/${id}.svg`;

function styleLayer(img, layer) {
	img.style.left = (layer.x * 100) + '%';
	img.style.top = (layer.y * 100) + '%';
	img.style.width = (layer.s * 100) + '%';
	img.style.transform = `translate(-50%, -50%) rotate(${layer.r || 0}deg)`;
	img.style.filter = `brightness(${layer.b}) contrast(${layer.c}) saturate(${layer.sat})`;
}

// Draw a saved symbol into any square element. Used by the builder and the gallery.
export function renderSymbol(node, layers) {
	node.replaceChildren();
	for (const layer of layers || []) {
		if (!CONFIG.SYMBOLS.includes(layer.id)) continue;
		const img = el('img', 'layer');
		img.src = srcOf(layer.id);
		img.alt = '';
		img.draggable = false;
		styleLayer(img, layer);
		node.append(img);
	}
}

export class SymbolBuilder {
	constructor(game) {
		this.game = game;
		this.stage = $('#stage');
		this.next = $('#symbol-next');
		this.layers = [];
		this.selected = -1;
		this.controls = {
			s: $('#ctl-size'), r: $('#ctl-turn'), b: $('#ctl-bright'), c: $('#ctl-contrast'), sat: $('#ctl-sat'),
		};

		const palette = $('#palette');
		for (const id of CONFIG.SYMBOLS) {
			const button = el('button', 'palette-item');
			button.type = 'button';
			button.setAttribute('aria-label', 'Add ' + id.replace(/-/g, ' '));
			const img = el('img');
			img.src = srcOf(id);
			img.alt = '';
			img.draggable = false;
			button.append(img);
			button.addEventListener('click', () => this.add(id));
			palette.append(button);
		}

		for (const [key, input] of Object.entries(this.controls)) {
			input.addEventListener('input', () => {
				const layer = this.layers[this.selected];
				if (!layer) return;
				layer[key] = Number(input.value);
				this.refresh(false);
			});
		}
		$('#ctl-up').addEventListener('click', () => this.reorder(1));
		$('#ctl-down').addEventListener('click', () => this.reorder(-1));
		$('#ctl-remove').addEventListener('click', () => this.remove());

		let drag = null;
		this.stage.addEventListener('pointerdown', (e) => {
			const img = e.target.closest('.layer');
			if (!img) { this.select(-1); return; }
			const index = Number(img.dataset.index);
			this.select(index);
			const layer = this.layers[index];
			drag = { layer, x0: e.clientX, y0: e.clientY, lx: layer.x, ly: layer.y };
			this.stage.setPointerCapture(e.pointerId);
		});
		this.stage.addEventListener('pointermove', (e) => {
			if (!drag) return;
			const r = this.stage.getBoundingClientRect();
			drag.layer.x = clamp(drag.lx + (e.clientX - drag.x0) / r.width, 0, 1);
			drag.layer.y = clamp(drag.ly + (e.clientY - drag.y0) / r.height, 0, 1);
			this.refresh(false);
		});
		const end = () => { drag = null; };
		this.stage.addEventListener('pointerup', end);
		this.stage.addEventListener('pointercancel', end);
		this.stage.addEventListener('wheel', (e) => {
			const layer = this.layers[this.selected];
			if (!layer) return;
			e.preventDefault();
			layer.s = clamp(layer.s * (e.deltaY < 0 ? 1.06 : 0.94), 0.12, 1.3);
			this.refresh(true);
		}, { passive: false });
		this.stage.addEventListener('keydown', (e) => {
			const layer = this.layers[this.selected];
			if (e.key === 'Tab' || !layer) return;
			const step = e.shiftKey ? 0.08 : 0.02;
			if (e.key === 'ArrowLeft') layer.x = clamp(layer.x - step, 0, 1);
			else if (e.key === 'ArrowRight') layer.x = clamp(layer.x + step, 0, 1);
			else if (e.key === 'ArrowUp') layer.y = clamp(layer.y - step, 0, 1);
			else if (e.key === 'ArrowDown') layer.y = clamp(layer.y + step, 0, 1);
			else if (e.key === 'Delete' || e.key === 'Backspace') { this.remove(); e.preventDefault(); return; }
			else if (e.key === '[') { this.select((this.selected - 1 + this.layers.length) % this.layers.length); return; }
			else if (e.key === ']') { this.select((this.selected + 1) % this.layers.length); return; }
			else return;
			e.preventDefault();
			this.refresh(false);
		});

		this.next.addEventListener('click', () => {
			if (this.layers.length === 0) return;
			showScreen('symbol', false);
			game.finish(this.layers.map((l) => ({ ...l })));
		});
	}

	begin() {
		this.layers = [];
		this.selected = -1;
		this.refresh(true);
		showScreen('symbol', true);
	}

	add(id) {
		if (this.layers.length >= CONFIG.MAX_SYMBOL_LAYERS) return;
		const n = this.layers.length;
		this.layers.push({ id, x: 0.5 + ((n % 3) - 1) * 0.06, y: 0.5 + ((n % 2) - 0.5) * 0.06, s: 0.55, r: 0, b: 1, c: 1, sat: 1 });
		this.selected = this.layers.length - 1;
		this.refresh(true);
	}

	select(index) {
		this.selected = index;
		this.refresh(true);
	}

	reorder(dir) {
		const i = this.selected;
		const j = i + dir;
		if (i < 0 || j < 0 || j >= this.layers.length) return;
		[this.layers[i], this.layers[j]] = [this.layers[j], this.layers[i]];
		this.selected = j;
		this.refresh(true);
	}

	remove() {
		if (this.selected < 0) return;
		this.layers.splice(this.selected, 1);
		this.selected = Math.min(this.selected, this.layers.length - 1);
		this.refresh(true);
	}

	refresh(rebuild) {
		if (rebuild) {
			renderSymbol(this.stage, this.layers);
			[...this.stage.children].forEach((img, i) => { img.dataset.index = i; });
		} else {
			[...this.stage.children].forEach((img, i) => styleLayer(img, this.layers[i]));
		}
		[...this.stage.children].forEach((img, i) => img.classList.toggle('selected', i === this.selected));
		const layer = this.layers[this.selected];
		$('#symbol-controls').classList.toggle('idle', !layer);
		for (const [key, input] of Object.entries(this.controls)) {
			input.disabled = !layer;
			if (layer && rebuild) input.value = layer[key];
		}
		for (const id of ['ctl-up', 'ctl-down', 'ctl-remove']) $('#' + id).disabled = !layer;
		this.next.hidden = this.layers.length === 0;
		const full = this.layers.length >= CONFIG.MAX_SYMBOL_LAYERS;
		for (const b of document.querySelectorAll('.palette-item')) b.disabled = full;
	}
}
