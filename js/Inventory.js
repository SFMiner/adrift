// What is held, and where it is kept.
// On hand: up to HAND_MAX fragments, shown as a transparent overlay over the shore.
// Containers: groups of fragments, drawn as constellations in the dark above the water.
// Placing a fragment in a container is permanent. There is no undo and no confirmation.
import { CONFIG } from './config.js';
import { hash01, makeRng } from './rng.js';
import { $, el, clamp, showScreen } from './ui.js';

const SVG = 'http://www.w3.org/2000/svg';
const SKY_BOTTOM = 0.42;	// share of the screen height that is sky

export class Inventory {
	constructor(game) {
		this.game = game;
		this.sky = $('#sky');
		this.cards = $('#cards');
		this.handsButton = $('#hands');
		this.skyDrop = $('#sky-drop');
		this.setDownButton = $('#set-down');
		this.lifted = null;		// id of the fragment picked out of the hand
		this.drag = null;

		this.handsButton.addEventListener('click', () => this.toggle());
		this.skyDrop.addEventListener('click', (e) => {
			if (!this.lifted) { this.close(); return; }
			const keyboard = e.detail === 0;
			if (keyboard) this.placeNew(this.lifted, null, null);
			else this.placeNew(this.lifted, e.clientX / window.innerWidth, e.clientY / window.innerHeight);
		});
		this.setDownButton.addEventListener('click', () => {
			if (this.lifted) this.setDown(this.lifted);
		});
		$('#hand').addEventListener('click', (e) => {
			if (e.target === $('#hand') || e.target === this.cards) {
				if (this.lifted) this.lift(null); else this.close();
			}
		});
	}

	get isOpen() { return this.game.overlay === 'hand'; }

	// === THE HAND ===

	open() {
		const game = this.game;
		if (game.phase !== 'shore' || game.overlay || game.run.hand.length === 0) return;
		game.overlay = 'hand';
		this.lifted = null;
		this.renderHand();
		showScreen('hand', true);
		const first = this.cards.querySelector('.card');
		if (first) first.focus({ preventScroll: true });
		game.hint('hand', 'choose one · then the dark above to keep it · or the sand to set it down');
	}

	close() {
		if (!this.isOpen) return;
		this.game.overlay = null;
		this.lifted = null;
		showScreen('hand', false);
		$('#game').classList.remove('lifting');
		this.game.clearHint();
	}

	toggle() { if (this.isOpen) this.close(); else this.open(); }

	renderHandsButton() {
		const game = this.game;
		const n = game.run ? game.run.hand.length : 0;
		this.handsButton.hidden = game.phase !== 'shore' || n === 0;
		this.handsButton.replaceChildren();
		for (let i = 0; i < CONFIG.HAND_MAX; i++) {
			this.handsButton.append(el('span', i < n ? 'mote held' : 'mote'));
		}
	}

	renderHand() {
		const game = this.game;
		this.cards.replaceChildren();
		game.run.hand.forEach((id, i) => {
			const frag = game.lib.get(id);
			if (!frag) return;
			const card = el('button', 'card ' + frag.type);
			card.type = 'button';
			card.dataset.id = id;
			card.textContent = frag.text;
			// Held loosely: nothing lines up.
			const tilt = (hash01(id) - 0.5) * 5;
			const lift = (hash01(id + 'y') - 0.5) * 34;
			card.style.setProperty('--tilt', tilt.toFixed(2) + 'deg');
			card.style.setProperty('--drift', lift.toFixed(0) + 'px');
			card.style.setProperty('--i', i);
			card.setAttribute('aria-pressed', this.lifted === id ? 'true' : 'false');
			if (this.lifted === id) card.classList.add('lifted');
			this.bindCard(card, id);
			this.cards.append(card);
		});
		$('#game').classList.toggle('lifting', !!this.lifted);
		this.renderHandsButton();
	}

	lift(id) {
		this.lifted = this.lifted === id ? null : id;
		for (const card of this.cards.children) {
			const on = card.dataset.id === this.lifted;
			card.classList.toggle('lifted', on);
			card.setAttribute('aria-pressed', on ? 'true' : 'false');
		}
		$('#game').classList.toggle('lifting', !!this.lifted);
		if (this.lifted) this.game.playEcho(this.game.lib.get(this.lifted), 0.35);
	}

	// A card can be clicked (lift, then choose a place) or dragged straight to a place.
	bindCard(card, id) {
		card.addEventListener('click', (e) => {
			if (this.suppressClick) { this.suppressClick = false; return; }
			this.lift(id);
			e.stopPropagation();
		});
		card.addEventListener('pointerdown', (e) => {
			if (e.button !== 0) return;
			this.drag = { id, card, x0: e.clientX, y0: e.clientY, moving: false, pointer: e.pointerId };
			// Capture now: a fast drag leaves the card before the first move event arrives.
			try { card.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
		});
		card.addEventListener('pointermove', (e) => {
			const d = this.drag;
			if (!d || d.card !== card) return;
			const dx = e.clientX - d.x0;
			const dy = e.clientY - d.y0;
			if (!d.moving && Math.hypot(dx, dy) > 9) {
				d.moving = true;
				card.classList.add('dragging');
				if (this.lifted !== id) this.lift(id);
			}
			if (d.moving) card.style.translate = `${dx}px ${dy}px`;
		});
		const end = (e) => {
			const d = this.drag;
			if (!d || d.card !== card) return;
			this.drag = null;
			if (!d.moving) return;
			this.suppressClick = true;
			setTimeout(() => { this.suppressClick = false; }, 0);
			card.classList.remove('dragging');
			card.style.translate = '';
			if (e.type === 'pointercancel') return;
			card.style.pointerEvents = 'none';
			const under = document.elementFromPoint(e.clientX, e.clientY);
			card.style.pointerEvents = '';
			const target = under && under.closest ? under.closest('.constellation') : null;
			const ny = e.clientY / window.innerHeight;
			if (target) this.placeInto(id, Number(target.dataset.index));
			else if (ny < SKY_BOTTOM) this.placeNew(id, e.clientX / window.innerWidth, ny);
			else if (ny > 0.86) this.setDown(id);
		};
		card.addEventListener('pointerup', end);
		card.addEventListener('pointercancel', end);
	}

	// === PLACING ===

	takeFromHand(id) {
		const hand = this.game.run.hand;
		const i = hand.indexOf(id);
		if (i < 0) return false;
		hand.splice(i, 1);
		return true;
	}

	afterPlacing(id) {
		const game = this.game;
		this.lifted = null;
		game.playEcho(game.lib.get(id), 0.5);
		game.changed();
		if (game.run.hand.length === 0) this.close(); else this.renderHand();
	}

	// A new container, at a point in the sky (normalised to the screen) or wherever there is room.
	placeNew(id, nx, ny) {
		const game = this.game;
		if (!this.takeFromHand(id)) return;
		const spot = this.freeSpot(nx, ny);
		game.run.containers.push({ x: spot.x, y: spot.y, fragments: [id] });
		this.afterPlacing(id);
		this.settle(game.run.containers.length - 1);
	}

	placeInto(id, index) {
		const game = this.game;
		const container = game.run.containers[index];
		if (!container || !this.takeFromHand(id)) return;
		container.fragments.push(id);
		this.afterPlacing(id);
		this.settle(index);
	}

	// Held fragments are uncommitted, so one can go back on the sand where you stand.
	setDown(id) {
		const game = this.game;
		if (!this.takeFromHand(id)) return;
		game.run.shore.push({ id, x: Math.round(game.run.playerX + (hash01(id + game.run.shore.length) - 0.5) * 60), y: 0.35 });
		this.afterPlacing(id);
	}

	// Keep containers apart, and inside the sky. A near miss never joins an existing container:
	// only a direct hit does, because joining is permanent.
	freeSpot(nx, ny) {
		const containers = this.game.run.containers;
		const rand = makeRng(containers.length * 7919 + this.game.run.seed);
		const ratio = window.innerWidth / Math.max(1, window.innerHeight);
		const far = (x, y) => containers.every((c) => Math.hypot((c.x - x) * ratio, c.y - y) > 0.15);
		let x = nx === null ? 0.1 + rand() * 0.8 : nx;
		let y = ny === null ? 0.08 + rand() * 0.26 : ny;
		for (let i = 0; i < 60; i++) {
			x = clamp(x, 0.07, 0.93);
			y = clamp(y, 0.08, SKY_BOTTOM - 0.06);
			if (far(x, y)) break;
			const spread = nx === null ? 1 : 0.08 + i * 0.012;
			x = (nx === null ? 0.5 : nx) + (rand() - 0.5) * spread;
			y = (ny === null ? 0.21 : ny) + (rand() - 0.5) * spread * (nx === null ? 0.3 : 1);
		}
		return { x: Math.round(clamp(x, 0.07, 0.93) * 1000) / 1000, y: Math.round(clamp(y, 0.08, SKY_BOTTOM - 0.06) * 1000) / 1000 };
	}

	settle(index) {
		const node = this.sky.querySelector(`.constellation[data-index="${index}"]`);
		if (!node) return;
		node.classList.remove('settling');
		void node.offsetWidth;
		node.classList.add('settling');
	}

	// === THE SKY ===

	renderSky() {
		const game = this.game;
		const run = game.run;
		this.sky.replaceChildren();
		if (!run) return;
		run.containers.forEach((c, index) => {
			const button = el('button', 'constellation');
			button.type = 'button';
			button.dataset.index = index;
			button.style.left = (c.x * 100) + '%';
			button.style.top = (c.y * 100) + '%';
			button.setAttribute('aria-label', 'A memory, holding ' + (c.fragments.length === 1 ? 'one fragment' : 'several fragments'));

			const svg = document.createElementNS(SVG, 'svg');
			svg.setAttribute('viewBox', '-50 -50 100 100');
			const rand = makeRng(index * 104729 + run.seed);
			const points = [];
			let answered = 0;
			c.fragments.forEach((id, i) => {
				// Stars spiral outward from the first, so adding one never moves the others.
				const angle = rand() * Math.PI * 2 + i * 2.4;
				const radius = i === 0 ? rand() * 6 : Math.min(40, 13 + i * 4.5 + rand() * 7);
				const frag = game.lib.get(id);
				const total = frag ? frag.questions.length : 0;
				const done = frag ? frag.questions.filter((q) => game.answerOf(id, q.id) !== undefined).length : 0;
				answered += done;
				points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.8, done, total });
			});
			if (points.length > 1) {
				const line = document.createElementNS(SVG, 'polyline');
				line.setAttribute('points', points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
				line.setAttribute('class', 'thread');
				svg.append(line);
			}
			for (const p of points) {
				const star = document.createElementNS(SVG, 'circle');
				star.setAttribute('cx', p.x.toFixed(1));
				star.setAttribute('cy', p.y.toFixed(1));
				star.setAttribute('r', (2.5 + Math.min(p.done, 4) * 0.9).toFixed(2));
				star.setAttribute('class', 'star');
				star.style.opacity = (0.42 + 0.58 * (p.total ? p.done / p.total : 0.3)).toFixed(2);
				svg.append(star);
			}
			button.style.setProperty('--answered', Math.min(answered, 8));
			button.append(svg);
			button.addEventListener('click', (e) => {
				e.stopPropagation();
				if (this.isOpen && this.lifted) this.placeInto(this.lifted, index);
				else game.openMemory(index);
			});
			this.sky.append(button);
		});
	}
}
