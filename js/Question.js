// Inside a portrait: the frame of pictures, the line saying how they belong together, and each
// fragment with the questions that could fix a detail of it.
// An answer is permanent and costs certainty. The cost is never shown as a number, only as a small
// light beside the question, which is consumed as the answer is held down.
// Setting the portrait is permanent too: after it, nothing in the frame can be moved or added.
import { CONFIG } from './config.js';
import { costOf } from './FragmentPool.js';
import { $, el, clamp, showScreen, holdToConfirm } from './ui.js';
import { renderPortrait, styleSymbol, answeredShare, cleanCaption } from './Portrait.js';

export function statementOf(question, answer) {
	return question.statement.replace('{}', answer);
}

export function cleanAnswer(raw) {
	return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, CONFIG.FREE_ANSWER_MAX);
}

export class MemoryView {
	constructor(game) {
		this.game = game;
		this.col = $('#memory-col');
		this.frame = $('#frame');
		this.caption = $('#caption');
		this.captionSet = $('#caption-set');
		this.setButton = $('#portrait-set');
		this.controls = { s: $('#frm-size'), r: $('#frm-turn') };
		this.index = -1;
		this.selected = null;		// id of the fragment whose picture is picked out
		this.openQuestion = null;	// "fragId/qid" of the question whose answers are showing
		this.drafts = new Map();	// typed but not yet fixed: kept so closing a question does not lose it
		this.caption.maxLength = CONFIG.CAPTION_MAX;
		this.controls.s.min = CONFIG.PORTRAIT_SYMBOL_MIN;
		this.controls.s.max = CONFIG.PORTRAIT_SYMBOL_MAX;

		$('#memory-close').addEventListener('click', () => this.close());
		$('#memory').addEventListener('click', (e) => {
			if (e.target === $('#memory') || e.target.classList.contains('portrait-layout')) this.close();
		});

		// --- arranging the frame ---
		let drag = null;
		this.frame.addEventListener('pointerdown', (e) => {
			const img = e.target.closest('.sym');
			this.select(img ? img.dataset.id : null);
			if (!img || !this.canArrange()) return;
			const spot = this.container.layout[img.dataset.id];
			drag = { spot, img, id: img.dataset.id, x0: e.clientX, y0: e.clientY, sx: spot.x, sy: spot.y };
			try { this.frame.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
		});
		this.frame.addEventListener('pointermove', (e) => {
			if (!drag) return;
			if (!this.canArrange()) { drag = null; return; }
			const r = this.frame.getBoundingClientRect();
			drag.spot.x = clamp(drag.sx + (e.clientX - drag.x0) / r.width, 0.04, 0.96);
			drag.spot.y = clamp(drag.sy + (e.clientY - drag.y0) / r.height, 0.04, 0.96);
			styleSymbol(drag.img, drag.spot, answeredShare(this.game, drag.id));
		});
		const end = () => {
			if (!drag) return;
			drag = null;
			this.game.changed();
		};
		this.frame.addEventListener('pointerup', end);
		this.frame.addEventListener('pointercancel', end);
		this.frame.addEventListener('wheel', (e) => {
			const spot = this.spot();
			if (!spot || !this.canArrange()) return;
			e.preventDefault();
			spot.s = clamp(spot.s * (e.deltaY < 0 ? 1.06 : 0.94), CONFIG.PORTRAIT_SYMBOL_MIN, CONFIG.PORTRAIT_SYMBOL_MAX);
			this.restyle();
			this.game.changed();
		}, { passive: false });
		this.frame.addEventListener('keydown', (e) => {
			const c = this.container;
			if (!c || e.key === 'Tab' || e.key === 'Escape') return;
			if (e.key === '[' || e.key === ']') {
				const i = c.fragments.indexOf(this.selected);
				const n = c.fragments.length;
				this.select(c.fragments[(i + (e.key === ']' ? 1 : n - 1) + n) % n]);
				e.stopPropagation();
				return;
			}
			const spot = this.spot();
			if (!spot || !this.canArrange()) return;
			const step = e.shiftKey ? 0.08 : 0.02;
			if (e.key === 'ArrowLeft') spot.x = clamp(spot.x - step, 0.04, 0.96);
			else if (e.key === 'ArrowRight') spot.x = clamp(spot.x + step, 0.04, 0.96);
			else if (e.key === 'ArrowUp') spot.y = clamp(spot.y - step, 0.04, 0.96);
			else if (e.key === 'ArrowDown') spot.y = clamp(spot.y + step, 0.04, 0.96);
			else return;
			e.preventDefault();
			e.stopPropagation();
			this.restyle();
			this.game.changed();
		});
		for (const [key, input] of Object.entries(this.controls)) {
			input.addEventListener('input', () => {
				const spot = this.spot();
				if (!spot || !this.canArrange()) return;
				spot[key] = Number(input.value);
				this.restyle();
			});
			input.addEventListener('change', () => this.game.changed());
		}

		// --- how they belong together ---
		this.caption.addEventListener('input', () => {
			const c = this.container;
			if (c && this.canArrange()) c.caption = this.caption.value.slice(0, CONFIG.CAPTION_MAX);
		});
		this.caption.addEventListener('change', () => this.game.autosave());
		this.caption.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') this.caption.blur();
		});

		holdToConfirm(this.setButton, () => CONFIG.SET_HOLD_MS * this.game.holdMs() / CONFIG.HOLD_MS, () => this.setPortrait(), null,
			() => this.game.say('keep it held down to set it for good'));
	}

	get isOpen() { return this.game.overlay === 'memory'; }
	get container() { return this.game.run ? this.game.run.containers[this.index] : null; }

	canArrange() {
		const c = this.container;
		return !!c && !c.set && this.game.phase === 'shore' && this.isOpen;
	}

	spot() {
		const c = this.container;
		return c && this.selected ? c.layout[this.selected] : null;
	}

	open(index) {
		const game = this.game;
		if (game.phase !== 'shore' || !game.run.containers[index]) return;
		if (game.overlay === 'hand') game.inventory.close();
		if (game.overlay) return;
		game.overlay = 'memory';
		this.index = index;
		this.openQuestion = null;
		this.selected = null;
		this.caption.value = this.container.caption || '';
		this.render();
		showScreen('memory', true);
		$('#game').classList.add('in-memory');
		$('#memory').scrollTop = 0;
		this.col.scrollTop = 0;
		const first = this.col.querySelector('button');
		if (first) first.focus({ preventScroll: true });
		if (this.container.set) game.hint('memory', 'choose a question · press and hold an answer to make it certain');
		else game.hint('portrait', 'move the pictures as you like · say how they belong together · hold "set" when it is whole');
	}

	close() {
		if (!this.isOpen) return;
		this.game.overlay = null;
		this.index = -1;
		this.selected = null;
		showScreen('memory', false);
		$('#game').classList.remove('in-memory');
		this.game.clearHint();
		this.game.autosave();
	}

	// Permanent. The frame closes, and its stars come out.
	setPortrait() {
		const game = this.game;
		const c = this.container;
		if (!c || c.set || game.phase !== 'shore') return;
		const index = this.index;
		c.caption = cleanCaption(this.caption.value);
		c.set = true;
		this.selected = null;
		game.changed();
		this.render();
		game.wait(1500).then(() => {
			if (this.isOpen && this.index === index) this.close();
			game.inventory.settle(index);
		});
	}

	select(id) {
		this.selected = id || null;
		for (const img of this.frame.children) img.classList.toggle('selected', img.dataset.id === this.selected);
		for (const article of this.col.children) article.classList.toggle('selected', article.dataset.id === this.selected);
		this.syncControls();
		if (this.selected) {
			const article = this.col.querySelector(`.frag[data-id="${this.selected}"]`);
			if (article) article.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}
	}

	syncControls() {
		const spot = this.canArrange() ? this.spot() : null;
		$('#frame-controls').classList.toggle('idle', !spot);
		for (const [key, input] of Object.entries(this.controls)) {
			input.disabled = !spot;
			if (spot) input.value = spot[key];
		}
	}

	restyle() {
		const c = this.container;
		if (!c) return;
		for (const img of this.frame.children) styleSymbol(img, c.layout[img.dataset.id], answeredShare(this.game, img.dataset.id));
		this.syncControls();
	}

	render() {
		const game = this.game;
		const container = this.container;
		this.col.replaceChildren();
		if (!container) return;

		// The frame.
		const open = !container.set && game.phase === 'shore';
		renderPortrait(this.frame, container, game);
		for (const img of this.frame.children) img.classList.toggle('selected', img.dataset.id === this.selected);
		$('#memory').classList.toggle('is-set', container.set);
		$('#frame-controls').hidden = !open;
		this.caption.hidden = !open;
		this.setButton.hidden = !open;
		this.captionSet.hidden = open || !container.caption;
		this.captionSet.textContent = container.caption;
		this.captionSet.classList.toggle('soft', !container.set);
		this.syncControls();

		// The fragments, and what could be made certain about each.
		for (const id of container.fragments) {
			const frag = game.lib.get(id);
			if (!frag) continue;
			const article = el('article', 'frag ' + frag.type);
			article.dataset.id = id;
			if (id === this.selected) article.classList.add('selected');
			const text = el('p', 'frag-text', frag.text);
			text.addEventListener('click', () => this.select(id));
			article.append(text);
			const list = el('ul', 'details');
			for (const q of frag.questions) {
				const answer = game.answerOf(id, q.id);
				const item = el('li');
				if (answer !== undefined) {
					item.className = 'fixed';
					item.dataset.fixed = id + '/' + q.id;
					item.textContent = statementOf(q, answer);
				} else if (game.phase !== 'shore') {
					// The last of the certainty has just gone. What was not asked stays unasked.
					item.className = 'open';
					item.append(el('span', 'unasked', q.prompt));
				} else {
					this.renderQuestion(item, frag, q);
				}
				list.append(item);
			}
			article.append(list);
			this.col.append(article);
		}
	}

	renderQuestion(item, frag, q) {
		const game = this.game;
		const key = frag.id + '/' + q.id;
		const cost = costOf(q);
		item.className = 'open';

		const prompt = el('button', 'prompt', q.prompt);
		prompt.type = 'button';
		const light = el('span', 'cost-light');
		light.style.setProperty('--cost', cost);
		light.setAttribute('aria-hidden', 'true');
		prompt.append(light);
		prompt.setAttribute('aria-expanded', this.openQuestion === key ? 'true' : 'false');
		prompt.addEventListener('click', () => {
			game.hint('memory', 'choose a question · press and hold an answer to make it certain');
			this.openQuestion = this.openQuestion === key ? null : key;
			this.render();
			const again = this.col.querySelector(`[data-key="${key}"] .prompt`);
			if (again) again.focus({ preventScroll: true });
		});
		item.dataset.key = key;
		item.append(prompt);
		if (this.openQuestion !== key) return;

		const answers = el('div', 'answers');
		const fix = (answer) => {
			const text = cleanAnswer(answer);
			if (!text) return;
			game.answer(frag.id, q, text);
			this.drafts.delete(key);
			this.openQuestion = null;
			if (this.isOpen) {
				this.render();
				const fixed = this.col.querySelector(`[data-fixed="${key}"]`);
				if (fixed) fixed.classList.add('just-fixed');
			}
		};
		const tooShort = () => game.say('keep it held down until the light is gone');
		const dim = (p) => light.style.setProperty('--spent', p.toFixed(3));
		for (const option of q.options) {
			const button = el('button', 'answer', option);
			button.type = 'button';
			holdToConfirm(button, () => game.holdMs(), () => fix(option), dim, tooShort);
			answers.append(button);
		}
		if (q.free) {
			const wrap = el('span', 'free');
			const input = el('input', 'free-input');
			input.type = 'text';
			input.maxLength = CONFIG.FREE_ANSWER_MAX;
			input.placeholder = 'or your own';
			input.autocomplete = 'off';
			input.spellcheck = false;
			input.setAttribute('aria-label', 'Your own answer');
			const commit = el('button', 'answer free-commit');
			commit.type = 'button';
			commit.setAttribute('aria-label', 'Hold to make your own answer certain');
			input.value = this.drafts.get(key) || '';
			commit.disabled = !cleanAnswer(input.value);
			input.addEventListener('input', () => {
				this.drafts.set(key, input.value);
				commit.disabled = !cleanAnswer(input.value);
			});
			input.addEventListener('keydown', (e) => {
				e.stopPropagation();
				// Typing is not answering. Enter points at the light that must be held.
				if (e.key === 'Enter' && cleanAnswer(input.value)) {
					commit.focus();
					game.say('hold the small light beside it to make it certain');
				}
			});
			holdToConfirm(commit, () => game.holdMs(), () => fix(input.value), dim, tooShort);
			wrap.append(input, commit);
			answers.append(wrap);
		}
		item.append(answers);
	}
}
