// Inside a memory: its fragments, and the questions that could fix a detail of each.
// An answer is permanent and costs certainty. The cost is never shown as a number, only as a small
// light beside the question, which is consumed as the answer is held down.
import { CONFIG } from './config.js';
import { costOf } from './FragmentPool.js';
import { $, el, showScreen, holdToConfirm } from './ui.js';

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
		this.index = -1;
		this.openQuestion = null;	// "fragId/qid" of the question whose answers are showing
		this.drafts = new Map();	// typed but not yet fixed: kept so closing a question does not lose it
		$('#memory-close').addEventListener('click', () => this.close());
		$('#memory').addEventListener('click', (e) => {
			if (e.target === $('#memory')) this.close();
		});
	}

	get isOpen() { return this.game.overlay === 'memory'; }

	open(index) {
		const game = this.game;
		if (game.phase !== 'shore' || !game.run.containers[index]) return;
		if (game.overlay === 'hand') game.inventory.close();
		if (game.overlay) return;
		game.overlay = 'memory';
		this.index = index;
		this.openQuestion = null;
		this.render();
		showScreen('memory', true);
		$('#game').classList.add('in-memory');
		$('#memory').scrollTop = 0;
		const first = this.col.querySelector('button');
		if (first) first.focus({ preventScroll: true });
		game.hint('memory', 'choose a question · press and hold an answer to make it certain');
	}

	close() {
		if (!this.isOpen) return;
		this.game.overlay = null;
		this.index = -1;
		showScreen('memory', false);
		$('#game').classList.remove('in-memory');
		this.game.clearHint();
	}

	render() {
		const game = this.game;
		const container = game.run.containers[this.index];
		this.col.replaceChildren();
		if (!container) return;
		for (const id of container.fragments) {
			const frag = game.lib.get(id);
			if (!frag) continue;
			const article = el('article', 'frag ' + frag.type);
			article.append(el('p', 'frag-text', frag.text));
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
