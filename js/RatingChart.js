// The rating chart: a plane with no labels. The player places one point, anywhere.
// They are not scoring the life; they are locating it. The axes mean what the player decides.
// Labels typed here are for the player's own thinking and are never saved: the gallery has no text.
import { CONFIG } from './config.js';
import { $, el, clamp, showScreen } from './ui.js';

export class RatingChart {
	constructor(game) {
		this.game = game;
		this.plane = $('#plane');
		this.point = $('#point');
		this.next = $('#rating-next');
		this.value = null;
		this.axisTurn = 0;

		const prompts = $('#axis-prompts');
		for (const pair of CONFIG.AXIS_PROMPTS) {
			const button = el('button', 'axis-prompt', pair.join(' / '));
			button.type = 'button';
			button.addEventListener('click', () => this.usePrompt(pair));
			prompts.append(button);
		}

		let dragging = false;
		const place = (e) => {
			const r = this.plane.getBoundingClientRect();
			this.set(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1));
		};
		this.plane.addEventListener('pointerdown', (e) => {
			dragging = true;
			this.plane.setPointerCapture(e.pointerId);
			place(e);
		});
		this.plane.addEventListener('pointermove', (e) => { if (dragging) place(e); });
		this.plane.addEventListener('pointerup', () => { dragging = false; });
		this.plane.addEventListener('pointercancel', () => { dragging = false; });
		this.plane.addEventListener('keydown', (e) => {
			const step = e.shiftKey ? 0.1 : 0.02;
			const v = this.value || { x: 0.5, y: 0.5 };
			let { x, y } = v;
			if (e.key === 'ArrowLeft') x -= step;
			else if (e.key === 'ArrowRight') x += step;
			else if (e.key === 'ArrowUp') y -= step;
			else if (e.key === 'ArrowDown') y += step;
			else if (e.key === 'Enter' || e.key === ' ') { /* place where it is */ }
			else return;
			e.preventDefault();
			this.set(clamp(x, 0, 1), clamp(y, 0, 1));
		});
		this.next.addEventListener('click', () => {
			if (!this.value) return;
			showScreen('rating', false);
			game.toSymbol(this.value);
		});
	}

	begin(saved = null) {
		this.value = null;
		this.point.hidden = true;
		this.next.hidden = true;
		this.axisTurn = 0;
		for (const id of ['axis-left', 'axis-right', 'axis-top', 'axis-bottom']) $('#' + id).value = '';
		showScreen('rating', true);
		if (saved) this.set(saved.x, saved.y);
		this.plane.focus({ preventScroll: true });
	}

	set(x, y) {
		this.value = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
		this.point.hidden = false;
		this.point.style.left = (x * 100) + '%';
		this.point.style.top = (y * 100) + '%';
		this.next.hidden = false;
		this.game.run.point = this.value;
		this.game.autosave();
	}

	// A suggested pair fills the horizontal axis first, then the vertical, then takes turns.
	usePrompt(pair) {
		const horizontal = this.axisTurn % 2 === 0;
		$(horizontal ? '#axis-right' : '#axis-top').value = pair[0];
		$(horizontal ? '#axis-left' : '#axis-bottom').value = pair[1];
		this.axisTurn++;
	}
}
