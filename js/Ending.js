// The reading. The assembled memories, one after another, in the order they were begun.
// Fixed details are set in full type. Unanswered questions stay, in softer type. No narration.
import { statementOf } from './Question.js';
import { $, el, showScreen } from './ui.js';

export class Reading {
	constructor(game) {
		this.game = game;
		this.page = $('#reading-page');
		this.next = $('#reading-next');
		this.index = 0;
		this.memories = [];
		this.busy = false;
		this.next.addEventListener('click', () => this.advance());
	}

	begin() {
		const game = this.game;
		this.memories = game.run.containers.filter((c) => c.fragments.some((id) => game.lib.has(id)));
		this.index = 0;
		this.busy = false;
		this.page.replaceChildren();
		showScreen('reading', true);
		if (this.memories.length === 0) {
			// Nothing was kept. The page stays empty for a moment, and then the life is located anyway.
			this.next.focus({ preventScroll: true });
			return;
		}
		this.show();
	}

	show() {
		const game = this.game;
		const container = this.memories[this.index];
		const block = el('div', 'memory-read');
		for (const id of container.fragments) {
			const frag = game.lib.get(id);
			if (!frag) continue;
			const part = el('div', 'read-frag');
			part.append(el('p', 'read-text', frag.text));
			for (const q of frag.questions) {
				const answer = game.answerOf(id, q.id);
				if (answer !== undefined) part.append(el('p', 'read-fixed', statementOf(q, answer)));
				else part.append(el('p', 'read-open', q.prompt));
			}
			block.append(part);
		}
		this.page.replaceChildren(block);
		this.page.scrollTop = 0;
		requestAnimationFrame(() => block.classList.add('shown'));
		this.next.focus({ preventScroll: true });
	}

	advance() {
		if (this.busy) return;
		const game = this.game;
		const block = this.page.firstElementChild;
		this.index++;
		const done = this.index >= this.memories.length;
		this.busy = true;
		if (block) block.classList.remove('shown');
		game.wait(block ? 1100 : 0).then(() => {
			this.busy = false;
			if (done) {
				showScreen('reading', false);
				game.toRating();
			} else {
				this.show();
			}
		});
	}
}
