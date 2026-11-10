// The shore: sand, water, the dark beyond it, the fragments, and the figure walking.
// Light is the only dynamic element. Everything here is drawn from a light state (see Certainty.js).
import { CONFIG } from './config.js';
import { hash01 } from './rng.js';
import { clamp, lerp } from './ui.js';

const WARM_SAND = [132, 106, 76];
const COLD_SAND = [70, 72, 82];
const NEAR_WATER = [52, 84, 98];
const FAR_WATER = [30, 54, 74];
const GLINT = [255, 216, 164];

const rgb = (c, k = 1, a = 1) => `rgba(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)},${a})`;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export class Environment {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.w = 0; this.h = 0; this.k = 1;
		// Smoothed light state, so thresholds are moments and not cuts.
		this.ambient = 1; this.farWater = 1; this.warmth = 1; this.light = 1;
		this.fade = 0;			// 0 = black (title, ending), 1 = the shore is shown
		this.fadeTarget = 0;
		this.fadeRate = 0.5;	// per second
		this.walkPhase = 0;
		this.resize();
	}

	resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.w = window.innerWidth;
		this.h = window.innerHeight;
		this.canvas.width = Math.round(this.w * dpr);
		this.canvas.height = Math.round(this.h * dpr);
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.k = clamp(this.h / 720, 0.6, 1.25);
		this.yHorizon = this.h * 0.44;
		this.yShore = this.h * 0.66;
		this.yFeet = this.h * 0.85;
	}

	// World x to screen x, and back.
	sx(wx, camX) { return (wx - camX) * this.k + this.w / 2; }
	wx(sx, camX) { return (sx - this.w / 2) / this.k + camX; }
	fragY(f) { return this.yShore + this.h * (0.035 + 0.085 * f.y); }

	// How far fragments can be seen at the current light.
	seeRadius() { return CONFIG.SEE_RADIUS * (0.62 + 0.38 * this.light); }

	// The shore fragment under a screen point, if any (used for click and touch).
	fragmentAt(px, py, run) {
		let best = null;
		let bestD = 34 * this.k;
		for (const f of run.shore) {
			if (Math.abs(f.x - run.playerX) > this.seeRadius()) continue;
			const d = Math.hypot(this.sx(f.x, run.playerX) - px, this.fragY(f) - py);
			if (d < bestD) { bestD = d; best = f; }
		}
		return best;
	}

	step(dt, target) {
		const ease = (cur, to, rate) => cur + (to - cur) * (1 - Math.exp(-dt * rate));
		this.light = ease(this.light, target.light, 1.2);
		this.ambient = ease(this.ambient, target.ambient, 0.9);
		this.farWater = ease(this.farWater, target.farWater, 0.45);
		this.warmth = ease(this.warmth, target.warmth, 0.4);
		const d = this.fadeTarget - this.fade;
		this.fade += clamp(d, -dt * this.fadeRate, dt * this.fadeRate);
	}

	fadeTo(value, seconds) {
		this.fadeTarget = value;
		this.fadeRate = seconds > 0 ? 1 / seconds : 1000;
	}

	draw(game, time) {
		const { ctx, w, h, k } = this;
		ctx.fillStyle = '#060504';
		ctx.fillRect(0, 0, w, h);
		const run = game.run;
		if (!run || this.fade <= 0.001) return;

		const cam = run.playerX;
		const amb = this.ambient;
		const t = time;

		this.drawWater(cam, amb, t);
		this.drawSand(cam, amb, t);
		this.drawDarkness(cam);
		this.drawFragments(game, cam, t);
		this.drawFigure(game, t);
		this.drawWorldEnds(cam);

		if (this.fade < 0.999) {
			ctx.fillStyle = `rgba(6,5,4,${1 - this.fade})`;
			ctx.fillRect(0, 0, w, h);
		}
	}

	shoreLine(x, cam, t) {
		const wxv = this.wx(x, cam);
		return this.yShore
			+ Math.sin(wxv * 0.006 + t * 0.35) * 5 * this.k
			+ Math.sin(wxv * 0.017 - t * 0.5) * 2.2 * this.k
			+ Math.sin(t * 0.42) * 4 * this.k;
	}

	drawWater(cam, amb, t) {
		const { ctx, w, k } = this;
		const top = this.yHorizon;
		const bottom = this.yShore + 14 * k;
		const g = ctx.createLinearGradient(0, top, 0, bottom);
		g.addColorStop(0, 'rgba(0,0,0,0)');
		g.addColorStop(0.3, rgb(FAR_WATER, amb * 0.55 * this.farWater));
		g.addColorStop(0.62, rgb(mix(NEAR_WATER, FAR_WATER, 0.5), amb * (0.25 + 0.6 * this.farWater)));
		g.addColorStop(1, rgb(NEAR_WATER, amb));
		ctx.fillStyle = g;
		ctx.fillRect(0, top, w, bottom - top);

		// Glints: short strokes that drift and breathe. Far ones go when the far water goes.
		ctx.lineCap = 'round';
		const cell = 90;
		const first = Math.floor(this.wx(0, cam * 0.8) / cell) - 1;
		const count = Math.ceil(w / (cell * k)) + 3;
		for (let i = first; i < first + count; i++) {
			for (let row = 0; row < 4; row++) {
				const key = i * 7 + row * 131;
				const depth = (row + hash01(key + 3)) / 4;			// 0 near the shore, 1 far out
				const gx = (i + hash01(key)) * cell;
				const x = (gx - cam * (0.92 - depth * 0.25)) * k + w / 2 + Math.sin(t * 0.3 + key) * 6;
				const y = lerp(this.yShore - 6 * k, top + 26 * k, depth);
				const flicker = 0.5 + 0.5 * Math.sin(t * (0.5 + hash01(key + 9)) + key);
				const far = depth > 0.45 ? this.farWater : 1;
				const a = amb * far * flicker * (0.20 - depth * 0.12);
				if (a < 0.01) continue;
				const len = (16 - depth * 9) * k;
				ctx.strokeStyle = `rgba(190,214,222,${a})`;
				ctx.lineWidth = Math.max(0.6, (1.3 - depth * 0.6) * k);
				ctx.beginPath();
				ctx.moveTo(x - len, y);
				ctx.lineTo(x + len, y);
				ctx.stroke();
			}
		}
	}

	drawSand(cam, amb, t) {
		const { ctx, w, h, k } = this;
		const sand = mix(COLD_SAND, WARM_SAND, this.warmth);

		ctx.beginPath();
		ctx.moveTo(0, h);
		for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, this.shoreLine(x, cam, t));
		ctx.lineTo(w, h);
		ctx.closePath();
		const g = ctx.createLinearGradient(0, this.yShore - 8 * k, 0, h);
		g.addColorStop(0, rgb(mix(sand, NEAR_WATER, 0.55), amb * 0.85));	// wet sand
		g.addColorStop(0.16, rgb(sand, amb * 0.8));
		g.addColorStop(1, rgb(sand, amb * 0.55));
		ctx.fillStyle = g;
		ctx.fill();

		// Foam: the edge of the water, and the line it left a moment ago.
		for (let pass = 0; pass < 2; pass++) {
			ctx.beginPath();
			for (let x = 0; x <= w + 8; x += 8) {
				const y = this.shoreLine(x, cam, t - pass * 2.4) + pass * 7 * k;
				if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
			}
			ctx.strokeStyle = `rgba(214,224,224,${amb * (pass ? 0.07 : 0.26)})`;
			ctx.lineWidth = (pass ? 1 : 1.6) * k;
			ctx.stroke();
		}

		// Grain.
		const cell = 46;
		const first = Math.floor(this.wx(0, cam) / cell) - 1;
		const count = Math.ceil(w / (cell * k)) + 3;
		for (let i = first; i < first + count; i++) {
			for (let j = 0; j < 5; j++) {
				const key = i * 13 + j * 977;
				const x = this.sx((i + hash01(key)) * cell, cam);
				const y = lerp(this.yShore + 18 * k, h, hash01(key + 5));
				const a = amb * (0.05 + 0.13 * hash01(key + 7));
				ctx.fillStyle = hash01(key + 11) > 0.5 ? `rgba(236,222,196,${a})` : `rgba(0,0,0,${a * 2})`;
				const s = (0.8 + hash01(key + 2) * 1.4) * k;
				ctx.fillRect(x, y, s, s);
			}
		}
	}

	// What this mind can still hold: a pool of sight around the figure, and nothing outside it.
	drawDarkness(cam) {
		const { ctx, w, h, k } = this;
		const radius = this.seeRadius() * k;
		const cx = w / 2;
		const cy = this.yFeet - 40 * k;
		ctx.save();
		ctx.translate(cx, cy);
		ctx.scale(1.35, 1);
		const g = ctx.createRadialGradient(0, 0, radius * 0.12, 0, 0, radius);
		g.addColorStop(0, 'rgba(6,5,4,0)');
		g.addColorStop(0.55, 'rgba(6,5,4,0.3)');
		g.addColorStop(1, 'rgba(6,5,4,1)');
		ctx.fillStyle = g;
		ctx.fillRect(-w, -h, w * 2, h * 2);
		ctx.restore();
	}

	drawFragments(game, cam, t) {
		const { ctx, k } = this;
		const run = game.run;
		const see = this.seeRadius();
		const nearest = game.nearestInReach ? game.nearestInReach() : null;
		const fontPx = Math.round(clamp(16 * k, 13, 20));
		ctx.textAlign = 'center';
		ctx.textBaseline = 'alphabetic';
		for (const f of run.shore) {
			const d = Math.abs(f.x - run.playerX);
			if (d > see) continue;
			const frag = game.lib.get(f.id);
			if (!frag) continue;
			const vis = clamp((see - d) / (see * 0.4), 0, 1);
			const x = this.sx(f.x, cam);
			const y = this.fragY(f);
			const pulse = 0.72 + 0.28 * Math.sin(t * 0.9 + hash01(f.id) * 20);
			const held = nearest && nearest.id === f.id ? 1.35 : 1;
			const a = vis * pulse * held * (0.5 + 0.5 * Math.max(this.light, 0.25));
			const r = 15 * k * held;

			ctx.save();
			ctx.translate(x, y);
			if (frag.type === 'relational') ctx.scale(2.1, 0.62); else ctx.scale(1, 0.8);
			const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
			g.addColorStop(0, rgb(GLINT, 1, Math.min(1, a * 0.95)));
			g.addColorStop(0.22, rgb(GLINT, 1, a * 0.42));
			g.addColorStop(1, rgb(GLINT, 1, 0));
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(0, 0, r, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();

			// Its first words surface when you stand near.
			if (d < CONFIG.WORDS_RADIUS) {
				const near = clamp(1 - d / CONFIG.WORDS_RADIUS, 0, 1);
				const words = frag.text.split(/\s+/);
				const lead = words.slice(0, 3).join(' ').replace(/[.,;:]+$/, '') + (words.length > 3 ? '…' : '');
				ctx.font = `italic 300 ${fontPx}px "Cormorant Garamond", Georgia, serif`;
				ctx.fillStyle = `rgba(245,240,232,${Math.min(0.8, near * 1.3) * (0.35 + 0.5 * held - 0.25)})`;
				ctx.fillText(lead, x, y - 20 * k);
			}
		}
	}

	drawFigure(game, t) {
		const { ctx, w, k } = this;
		const x = w / 2;
		const moving = game.moving ? 1 : 0;
		this.walkPhase += moving * 0.14;
		const bob = Math.sin(this.walkPhase) * 1.6 * k * moving;
		const y = this.yFeet + bob;
		const a = 0.2 + 0.5 * Math.max(this.ambient, 0.12);

		// A pale shape, more a posture than a person.
		ctx.save();
		ctx.translate(x, y);
		const height = 62 * k;
		const g = ctx.createLinearGradient(0, -height, 0, 0);
		g.addColorStop(0, `rgba(226,216,198,${a})`);
		g.addColorStop(1, `rgba(226,216,198,${a * 0.25})`);
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(-4.5 * k, -height * 0.8);
		ctx.quadraticCurveTo(-8 * k, -height * 0.4, -6 * k, 0);
		ctx.lineTo(6 * k, 0);
		ctx.quadraticCurveTo(8 * k, -height * 0.4, 4.5 * k, -height * 0.8);
		ctx.closePath();
		ctx.fill();
		ctx.beginPath();
		ctx.arc(0, -height * 0.9, 5.2 * k, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(226,216,198,${a})`;
		ctx.fill();
		// Shadow on the sand.
		ctx.scale(1, 0.28);
		const s = ctx.createRadialGradient(0, 4, 0, 0, 4, 26 * k);
		s.addColorStop(0, 'rgba(0,0,0,0.5)');
		s.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = s;
		ctx.beginPath();
		ctx.arc(0, 4, 26 * k, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// What is held drifts close by.
		const n = game.run.hand.length;
		for (let i = 0; i < n; i++) {
			const ang = t * 0.5 + (i / Math.max(n, 1)) * Math.PI * 2;
			const hx = x + Math.cos(ang) * 17 * k;
			const hy = y - 36 * k + Math.sin(ang * 1.3) * 8 * k;
			const g2 = ctx.createRadialGradient(hx, hy, 0, hx, hy, 7 * k);
			g2.addColorStop(0, rgb(GLINT, 1, 0.8));
			g2.addColorStop(1, rgb(GLINT, 1, 0));
			ctx.fillStyle = g2;
			ctx.beginPath();
			ctx.arc(hx, hy, 7 * k, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// The shore does not end; it stops being held.
	drawWorldEnds(cam) {
		const { ctx, w, h, k } = this;
		const span = 420 * k;
		const left = this.sx(0, cam);
		if (left > -span) {
			const g = ctx.createLinearGradient(left, 0, left + span, 0);
			g.addColorStop(0, 'rgba(6,5,4,1)');
			g.addColorStop(1, 'rgba(6,5,4,0)');
			ctx.fillStyle = g;
			ctx.fillRect(Math.min(0, left), 0, left + span - Math.min(0, left), h);
			if (left > 0) { ctx.fillStyle = 'rgb(6,5,4)'; ctx.fillRect(0, 0, left, h); }
		}
		const right = this.sx(CONFIG.WORLD_WIDTH, cam);
		if (right < w + span) {
			const g = ctx.createLinearGradient(right - span, 0, right, 0);
			g.addColorStop(0, 'rgba(6,5,4,0)');
			g.addColorStop(1, 'rgba(6,5,4,1)');
			ctx.fillStyle = g;
			ctx.fillRect(right - span, 0, w - (right - span), h);
		}
	}
}
