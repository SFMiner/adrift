// Adrift audio: a synthesised shore bed plus 38 half-remembered "echo" recipes.
// Web Audio only, no samples, no music. Recipes use only nodes that also work in OfflineAudioContext.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SILENT = 0.0001;

// ---------- helpers ----------

const noiseBuffers = new WeakMap();
function whiteBuffer(ctx) {
	let buf = noiseBuffers.get(ctx);
	if (!buf) {
		const n = Math.floor(ctx.sampleRate * 2);
		buf = ctx.createBuffer(1, n, ctx.sampleRate);
		const d = buf.getChannelData(0);
		let s = 0x9e3779b9; // fixed internal PRNG (mulberry32) so the buffer is deterministic
		for (let i = 0; i < n; i++) {
			s = (s + 0x6d2b79f5) | 0;
			let x = Math.imul(s ^ (s >>> 15), 1 | s);
			x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
			d[i] = (((x ^ (x >>> 14)) >>> 0) / 4294967296) * 2 - 1;
		}
		noiseBuffers.set(ctx, buf);
	}
	return buf;
}

// Attack to `gain`, hold, then exponential release ending at t + dur.
function envelope(param, t, dur, gain, attack = 0.01, release) {
	attack = Math.min(attack, dur * 0.9);
	release = Math.min(release == null ? dur - attack : release, dur - attack);
	param.setValueAtTime(SILENT, t);
	param.linearRampToValueAtTime(gain, t + attack);
	if (release < dur - attack - 0.001) param.setValueAtTime(gain, t + dur - release);
	param.exponentialRampToValueAtTime(SILENT, t + dur);
}

// Optional slow amplitude modulation, then connect to dest.
function finish(ctx, node, o, t, dur, dest) {
	let out = node;
	if (o.am) {
		const am = ctx.createGain();
		am.gain.value = 1 - o.am.depth / 2;
		const lfo = ctx.createOscillator();
		const lg = ctx.createGain();
		lfo.frequency.value = o.am.rate;
		lg.gain.value = o.am.depth / 2;
		lfo.connect(lg);
		lg.connect(am.gain);
		lfo.start(t);
		lfo.stop(t + dur + 0.1);
		out.connect(am);
		out = am;
	}
	out.connect(dest);
}

function chainFilters(ctx, node, filters) {
	if (!filters) return node;
	let out = node;
	for (const f of Array.isArray(filters) ? filters : [filters]) {
		const bq = ctx.createBiquadFilter();
		bq.type = f.type;
		bq.frequency.value = f.f;
		bq.Q.value = f.q == null ? 1 : f.q;
		out.connect(bq);
		out = bq;
	}
	return out;
}

// tone: frequency glides f0 -> f1 (optionally through o.mid = [fraction, freq]).
export function tone(ctx, dest, o) {
	const { t, dur, f0, type = 'sine', gain = 0.2, attack = 0.01, release } = o;
	const f1 = o.f1 == null ? f0 : o.f1;
	const osc = ctx.createOscillator();
	osc.type = type;
	osc.frequency.setValueAtTime(f0, t);
	if (o.mid) osc.frequency.exponentialRampToValueAtTime(o.mid[1], t + dur * o.mid[0]);
	if (f1 !== f0 || o.mid) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
	if (o.vibrato) {
		const lfo = ctx.createOscillator();
		const lg = ctx.createGain();
		lfo.frequency.value = o.vibrato.rate;
		lg.gain.value = o.vibrato.depth;
		lfo.connect(lg);
		lg.connect(osc.frequency);
		lfo.start(t);
		lfo.stop(t + dur + 0.1);
	}
	const g = ctx.createGain();
	envelope(g.gain, t, dur, gain, attack, release);
	chainFilters(ctx, osc, o.filter).connect(g);
	finish(ctx, g, o, t, dur, dest);
	osc.start(t);
	osc.stop(t + dur + 0.05);
}

// noise: filtered white noise; filter frequency glides f0 -> f1.
export function noise(ctx, dest, o) {
	const { t, dur, type = 'bandpass', f0, q = 1, gain = 0.2, attack = 0.01, release } = o;
	const f1 = o.f1 == null ? f0 : o.f1;
	const src = ctx.createBufferSource();
	src.buffer = whiteBuffer(ctx);
	src.loop = true;
	const f = ctx.createBiquadFilter();
	f.type = type;
	f.Q.value = q;
	f.frequency.setValueAtTime(f0, t);
	if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
	const g = ctx.createGain();
	envelope(g.gain, t, dur, gain, attack, release);
	src.connect(f);
	f.connect(g);
	finish(ctx, g, o, t, dur, dest);
	src.start(t, o.off || 0);
	src.stop(t + dur + 0.05);
}

// ---------- recipes ----------
// Each recipe receives { tone, noise, r, rr, p }; times are seconds from the echo's start.

const RECIPES = {
	// --- animals ---
	birdsong({ tone, r, rr }) {
		const n = 3 + Math.floor(r() * 4);
		const base = rr(2000, 3000);
		let t = 0;
		for (let i = 0; i < n; i++) {
			const f0 = clamp(base * rr(0.85, 1.15), 2000, 3600);
			const up = r() < 0.5;
			tone({ t, dur: rr(0.07, 0.15), f0, f1: clamp(f0 * (up ? rr(1.2, 1.5) : rr(0.65, 0.85)), 1800, 4000), gain: 0.12, attack: 0.02 });
			t += rr(0.14, 0.34);
		}
	},
	trill({ tone, r, rr }) {
		const n = 15 + Math.floor(r() * 11);
		const f = rr(2200, 3200);
		for (let i = 0; i < n; i++) {
			tone({ t: (i / n) * 1.1 + rr(0, 0.01), dur: 0.03, f0: f * rr(0.97, 1.03), f1: f * 1.1, gain: 0.1, attack: 0.006 });
		}
	},
	caw({ tone, r, rr }) {
		const n = 2 + Math.floor(r() * 2);
		for (let i = 0; i < n; i++) {
			const f = 450 * rr(0.92, 1.08);
			tone({ t: i * rr(0.34, 0.42), dur: rr(0.2, 0.28), f0: f, f1: f * 0.7, type: 'sawtooth', gain: 0.3, attack: 0.03, filter: { type: 'bandpass', f: 1000, q: 1.2 } });
		}
	},
	quack({ tone, r, rr }) {
		const n = 2 + Math.floor(r() * 3);
		let t = 0;
		for (let i = 0; i < n; i++) {
			const f = 350 * rr(0.9, 1.1);
			tone({ t, dur: rr(0.1, 0.15), f0: f, f1: f * 0.8, type: 'square', gain: 0.2, attack: 0.015, filter: { type: 'bandpass', f: 900, q: 2 } });
			t += rr(0.16, 0.24);
		}
	},
	shriek({ tone, rr }) {
		const d = rr(0.9, 1.1);
		tone({ t: 0, dur: d, f0: 3000, f1: 1800, gain: 0.18, attack: 0.12, vibrato: { rate: 9, depth: 90 } });
		tone({ t: 0, dur: d, f0: 6000, f1: 3600, gain: 0.03, attack: 0.12 });
	},
	bark({ tone, noise, rr }) {
		let t = 0;
		for (let i = 0; i < 2; i++) {
			tone({ t, dur: 0.2, f0: 250, f1: 150, type: 'sawtooth', gain: 0.25, attack: 0.012, filter: { type: 'lowpass', f: 900 } });
			noise({ t, dur: 0.15, f0: 800, q: 0.8, gain: 0.25, attack: 0.008 });
			t += rr(0.34, 0.46);
		}
	},
	growl({ tone }) {
		tone({ t: 0, dur: 1.5, f0: 70, f1: 62, type: 'sawtooth', gain: 0.45, attack: 0.3, am: { rate: 25, depth: 0.9 }, filter: { type: 'lowpass', f: 300 } });
	},
	meow({ tone, rr }) {
		const f = rr(0.95, 1.05);
		tone({ t: 0, dur: 0.8, f0: 500 * f, mid: [0.4, 800 * f], f1: 450 * f, type: 'sawtooth', gain: 0.3, attack: 0.08, filter: { type: 'bandpass', f: 1200, q: 2 } });
	},
	howl({ tone }) {
		tone({ t: 0, dur: 3, f0: 300, mid: [0.5, 520], f1: 380, gain: 0.2, attack: 0.8, release: 1.4, vibrato: { rate: 5, depth: 7 } });
		tone({ t: 0, dur: 3, f0: 600, mid: [0.5, 1040], f1: 760, gain: 0.05, attack: 0.9, release: 1.4, vibrato: { rate: 5, depth: 12 } });
	},
	lowing({ tone }) {
		tone({ t: 0, dur: 1.6, f0: 140, f1: 105, type: 'sawtooth', gain: 0.3, attack: 0.25, filter: [{ type: 'lowpass', f: 700, q: 4 }] });
	},
	croak({ tone, noise, r, rr }) {
		const n = 3 + Math.floor(r() * 2);
		let t = 0;
		for (let i = 0; i < n; i++) {
			tone({ t, dur: 0.11, f0: 100 * rr(0.95, 1.05), f1: 80, type: 'square', gain: 0.22, attack: 0.01, filter: { type: 'lowpass', f: 600 } });
			noise({ t, dur: 0.1, f0: 400, q: 2, gain: 0.2, attack: 0.01 });
			t += rr(0.17, 0.25);
		}
	},
	peep({ tone, r, rr }) {
		const n = 6 + Math.floor(r() * 5);
		let t = 0;
		for (let i = 0; i < n; i++) {
			const f = 2800 * rr(0.95, 1.05);
			tone({ t, dur: 0.07, f0: f, f1: f * 1.15, gain: 0.1, attack: 0.012 });
			t += rr(0.1, 0.26);
		}
	},
	hooves({ noise, r, rr }) {
		const n = 4 + Math.floor(r() * 3);
		for (let i = 0; i < n; i++) {
			const t = i * 0.42 + rr(0, 0.03);
			noise({ t, dur: 0.045, f0: 900, q: 3, gain: 0.4, attack: 0.003 });
			noise({ t: t + rr(0.11, 0.14), dur: 0.05, f0: 600, q: 3, gain: 0.3, attack: 0.003 });
		}
	},

	// --- weather and ground ---
	wind({ noise, rr }) {
		const d = rr(3.2, 3.8);
		noise({ t: 0, dur: d, f0: 350, f1: 600, q: 2, gain: 0.3, attack: d * 0.45, release: d * 0.5 });
		noise({ t: 0, dur: d, f0: 750, f1: 420, q: 2.5, gain: 0.2, attack: d * 0.4, release: d * 0.55 });
	},
	rain({ noise, r, rr }) {
		noise({ t: 0, dur: 2.5, type: 'highpass', f0: 3000, gain: 0.05, attack: 0.5 });
		for (let i = 0; i < 70; i++) {
			noise({ t: rr(0, 2.4), dur: 0.015, type: 'highpass', f0: rr(3500, 6000), gain: rr(0.04, 0.16), attack: 0.002 });
		}
	},
	fire({ noise, r, rr }) {
		noise({ t: 0, dur: 2.5, type: 'lowpass', f0: 250, gain: 0.4, attack: 0.4 });
		const n = 8 + Math.floor(r() * 8);
		for (let i = 0; i < n; i++) {
			noise({ t: rr(0, 2.3), dur: rr(0.01, 0.025), type: 'highpass', f0: rr(2000, 4000), gain: rr(0.15, 0.4), attack: 0.001 });
		}
	},
	leaves({ noise, r, rr }) {
		const n = 2 + Math.floor(r() * 2);
		let t = 0;
		for (let i = 0; i < n; i++) {
			const d = rr(0.3, 0.55);
			noise({ t, dur: d, f0: rr(3500, 5500), q: 0.8, gain: 0.2, attack: d * 0.35, release: d * 0.5 });
			t += d * rr(0.5, 0.9) + rr(0.05, 0.2);
		}
	},
	water({ tone, noise, r, rr }) {
		noise({ t: 0, dur: 1.8, type: 'lowpass', f0: 600, gain: 0.16, attack: 0.5 });
		const n = 4 + Math.floor(r() * 3);
		for (let i = 0; i < n; i++) {
			const f = rr(300, 500);
			tone({ t: rr(0, 1.5), dur: rr(0.07, 0.12), f0: f, f1: f * rr(1.6, 1.9), gain: 0.1, attack: 0.01 });
		}
	},
	hiss({ noise }) {
		noise({ t: 0, dur: 1.2, type: 'highpass', f0: 5000, gain: 0.14, attack: 0.1 });
	},
	footsteps({ tone, noise, rr }) {
		for (let i = 0; i < 4; i++) {
			const t = i * 0.5 + rr(0, 0.02);
			tone({ t, dur: 0.18, f0: 90, f1: 50, gain: 0.3, attack: 0.008 });
			noise({ t, dur: 0.08, type: 'lowpass', f0: 500, gain: 0.2, attack: 0.005 });
		}
	},

	// --- objects and machines ---
	bell({ tone, rr }) {
		const f = 440 * rr(0.99, 1.01);
		[[1, 0.2, 3.5], [2.76, 0.12, 2.5], [5.4, 0.06, 1.5], [8.9, 0.03, 0.9]].forEach(([m, g, d]) => {
			tone({ t: 0, dur: d, f0: f * m, gain: g, attack: 0.004 });
		});
	},
	clink({ tone, r, rr }) {
		const n = 2 + Math.floor(r() * 2);
		let t = 0;
		for (let i = 0; i < n; i++) {
			const f = rr(2000, 4000);
			tone({ t, dur: 0.4, f0: f, gain: 0.12, attack: 0.002 });
			tone({ t, dur: 0.22, f0: f * 1.52, gain: 0.06, attack: 0.002 });
			t += rr(0.12, 0.3);
		}
	},
	clack({ tone, noise, r, rr }) {
		const n = 5 + Math.floor(r() * 4);
		let t = 0;
		for (let i = 0; i < n; i++) {
			noise({ t, dur: 0.025, f0: rr(2000, 3000), q: 2, gain: 0.3, attack: 0.002 });
			tone({ t, dur: 0.02, f0: 180, type: 'square', gain: 0.08, attack: 0.002, filter: { type: 'lowpass', f: 800 } });
			t += rr(0.06, 0.22);
		}
		if (r() < 0.3) {
			tone({ t: t + 0.05, dur: 0.9, f0: 1400, gain: 0.08, attack: 0.003 });
			tone({ t: t + 0.05, dur: 0.5, f0: 1400 * 2.76, gain: 0.03, attack: 0.003 });
		}
	},
	modem({ tone, noise }) {
		const bp = f => ({ type: 'bandpass', f, q: 2 });
		tone({ t: 0, dur: 0.55, f0: 1100, gain: 0.14, attack: 0.04, filter: bp(1100) });
		tone({ t: 0.5, dur: 0.55, f0: 2100, gain: 0.12, attack: 0.04, filter: bp(2100) });
		noise({ t: 1.0, dur: 1.5, f0: 1200, f1: 2400, q: 5, gain: 0.35, attack: 0.1, am: { rate: 11, depth: 0.8 } });
		tone({ t: 1.1, dur: 1.4, f0: 1700, gain: 0.08, attack: 0.1, vibrato: { rate: 14, depth: 420 }, filter: bp(1700) });
	},
	phone({ tone }) {
		for (const t of [0, 1.3]) {
			for (const f of [440, 480]) tone({ t, dur: 0.8, f0: f, gain: 0.12, attack: 0.03, release: 0.06, am: { rate: 20, depth: 1 } });
		}
	},
	alarm({ tone, r, rr }) {
		const n = 4 + Math.floor(r() * 3);
		for (let i = 0; i < n; i++) tone({ t: i * rr(0.2, 0.24), dur: 0.1, f0: 2000, gain: 0.14, attack: 0.012 });
	},
	static({ tone, noise, rr }) {
		noise({ t: 0, dur: 2, type: 'highpass', f0: 1500, gain: 0.14, attack: 0.25, am: { rate: 0.9, depth: 0.6 } });
		for (let i = 0; i < 24; i++) {
			noise({ t: rr(0, 1.9), dur: 0.012, type: 'highpass', f0: rr(1500, 3500), gain: rr(0.08, 0.25), attack: 0.001 });
		}
		tone({ t: 0, dur: 2, f0: 1800, f1: 2300, gain: 0.03, attack: 0.5, vibrato: { rate: 0.7, depth: 150 } });
	},
	engine({ tone, noise }) {
		const base = { t: 0, dur: 3, attack: 1.4, release: 1.5 };
		tone({ ...base, f0: 105, mid: [0.5, 91], f1: 84, type: 'sawtooth', gain: 0.3, filter: { type: 'lowpass', f: 420 } });
		tone({ ...base, f0: 210, mid: [0.5, 182], f1: 168, type: 'sawtooth', gain: 0.08, filter: { type: 'lowpass', f: 420 } });
		noise({ ...base, type: 'lowpass', f0: 300, f1: 260, gain: 0.3 });
	},
	brakes({ tone, rr }) {
		const d = rr(0.9, 1.05);
		tone({ t: 0, dur: d, f0: 2400, f1: 2300, gain: 0.1, attack: 0.1, release: 0.5, vibrato: { rate: 30, depth: 20 } });
		tone({ t: 0, dur: d, f0: 2440, f1: 2330, gain: 0.1, attack: 0.1, release: 0.5 });
	},
	thud({ tone, noise }) {
		tone({ t: 0, dur: 0.7, f0: 90, f1: 40, gain: 0.5, attack: 0.004 });
		noise({ t: 0, dur: 0.3, type: 'lowpass', f0: 250, gain: 0.5, attack: 0.003 });
	},
	shot({ noise }) {
		noise({ t: 0, dur: 0.07, type: 'highpass', f0: 800, gain: 0.35, attack: 0.001 });
		noise({ t: 0, dur: 1.8, type: 'lowpass', f0: 500, f1: 150, gain: 0.3, attack: 0.02 });
	},

	// --- people ---
	breath({ noise, rr }) {
		noise({ t: 0, dur: 1.3, f0: 900, f1: 1100, q: 1.2, gain: 0.3, attack: 0.65, release: 0.6 });
		noise({ t: 1.35 + rr(0, 0.15), dur: 1.6, f0: 1100, f1: 800, q: 1.2, gain: 0.3, attack: 0.5, release: 1.0 });
	},
	heartbeat({ tone, rr }) {
		for (let i = 0; i < 3; i++) {
			const t = i * rr(0.85, 0.95);
			tone({ t, dur: 0.22, f0: 70, f1: 50, gain: 0.4, attack: 0.012 });
			tone({ t: t + 0.24, dur: 0.2, f0: 62, f1: 48, gain: 0.28, attack: 0.012 });
		}
	},
	hum({ tone, r, rr }) {
		const scale = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
		const n = 3 + Math.floor(r() * 2);
		for (let i = 0; i < n; i++) {
			const f = 220 * scale[Math.floor(r() * scale.length)];
			const o = { t: i * 0.72, dur: rr(0.8, 1.0), attack: 0.15, release: 0.55, vibrato: { rate: 5, depth: 3 } };
			tone({ ...o, f0: f, gain: 0.16 });
			tone({ ...o, f0: f * 2, gain: 0.04 });
		}
	},
	murmur({ tone, r, rr }) {
		const voices = [rr(105, 130), rr(170, 210)];
		voices.forEach((pitch, v) => {
			let t = v * 0.13;
			while (t < 2.2) {
				const d = rr(0.07, 0.17);
				if (r() < 0.8) {
					tone({ t, dur: d, f0: pitch * rr(0.9, 1.15), type: 'sawtooth', gain: 0.12, attack: 0.03, filter: [{ type: 'bandpass', f: rr(400, 2200), q: 3 }, { type: 'lowpass', f: 1500 }] });
				}
				t += d + rr(0.02, 0.14);
			}
		});
	},
	laugh({ tone, noise, r, rr }) {
		const n = 5 + Math.floor(r() * 4);
		let t = 0;
		for (let i = 0; i < n; i++) {
			const f = 480 - (130 * i) / (n - 1) + rr(-12, 12);
			tone({ t, dur: 0.1, f0: f, f1: f * 0.9, type: 'sawtooth', gain: 0.1, attack: 0.02, filter: [{ type: 'bandpass', f: 900, q: 2 }, { type: 'lowpass', f: 1800 }] });
			noise({ t, dur: 0.1, f0: 1500, q: 0.8, gain: 0.1, attack: 0.02 });
			t += rr(0.12, 0.17);
		}
	},

	// --- abstract ---
	shimmer({ tone, r, rr }) {
		const n = 3 + Math.floor(r() * 3);
		for (let i = 0; i < n; i++) {
			const f = rr(1500, 5000);
			const o = { t: rr(0, 0.5), dur: 2.3, attack: 0.9, release: 1.2, gain: 0.05 };
			tone({ ...o, f0: f });
			tone({ ...o, f0: f + rr(0.6, 2.5) }); // slow beating
		}
	},
	drone({ tone }) {
		const o = { t: 0, dur: 3.5, attack: 1.5, release: 1.8 };
		tone({ ...o, f0: 65, gain: 0.2 });
		tone({ ...o, f0: 65.5, gain: 0.2 });
		tone({ ...o, f0: 97.5, gain: 0.12 });
	},
};

export const RECIPE_NAMES = [
	'birdsong', 'trill', 'caw', 'quack', 'shriek', 'bark', 'growl', 'meow', 'howl', 'lowing', 'croak', 'peep', 'hooves',
	'wind', 'rain', 'fire', 'leaves', 'water', 'hiss', 'footsteps',
	'bell', 'clink', 'clack', 'modem', 'phone', 'alarm', 'static', 'engine', 'brakes', 'thud', 'shot',
	'breath', 'heartbeat', 'hum', 'murmur', 'laugh',
	'shimmer', 'drone',
];

// Per-recipe level trims, calibrated by rendering each recipe offline so peaks land near 0.25.
const TRIM = {
	birdsong: 2.007,
	trill: 2.408,
	caw: 1.094,
	quack: 1.969,
	shriek: 1.171,
	bark: 0.873,
	growl: 0.528,
	meow: 1.439,
	howl: 0.964,
	lowing: 0.611,
	croak: 0.929,
	peep: 2.404,
	hooves: 2.726,
	wind: 2.481,
	rain: 1.204,
	fire: 0.626,
	leaves: 1.22,
	water: 2.039,
	hiss: 1.112,
	footsteps: 0.801,
	bell: 0.606,
	clink: 1.344,
	clack: 1.26,
	modem: 1.719,
	phone: 1.408,
	alarm: 1.721,
	static: 0.795,
	engine: 0.573,
	brakes: 1.2,
	thud: 0.488,
	shot: 0.628,
	breath: 1.621,
	heartbeat: 0.625,
	hum: 1.2,
	murmur: 4.338,
	laugh: 2.529,
	shimmer: 0.859,
	drone: 0.511,
};

function scaleFilters(f, p) {
	if (!f) return f;
	return Array.isArray(f) ? f.map(x => ({ ...x, f: x.f * p })) : { ...f, f: f.f * p };
}

export function playRecipe(ctx, dest, name, t0, opt = {}) {
	const known = Object.prototype.hasOwnProperty.call(RECIPES, name);
	const key = known ? name : 'shimmer';
	const p = opt.pitch == null ? 1 : opt.pitch;
	const r = opt.rand || Math.random;
	const out = ctx.createGain();
	out.gain.value = TRIM[key] == null ? 1 : TRIM[key];
	out.connect(dest);
	let end = 0;
	const e = {
		p, r,
		rr: (a, b) => a + (b - a) * r(),
		tone(o) {
			end = Math.max(end, o.t + o.dur);
			tone(ctx, out, {
				...o, t: t0 + o.t, f0: o.f0 * p, f1: o.f1 == null ? undefined : o.f1 * p,
				mid: o.mid && [o.mid[0], o.mid[1] * p],
				vibrato: o.vibrato && { rate: o.vibrato.rate, depth: o.vibrato.depth * p },
				filter: scaleFilters(o.filter, p),
			});
		},
		noise(o) {
			end = Math.max(end, o.t + o.dur);
			noise(ctx, out, { ...o, t: t0 + o.t, f0: o.f0 * p, f1: o.f1 == null ? undefined : o.f1 * p, off: r() * 1.5 });
		},
	};
	RECIPES[key](e);
	return clamp(end, 0.5, 4.5);
}

// ---------- shore bed and player ----------

const BED_PEAK = 0.126; // about -18 dBFS

function brownBuffer(ctx, seconds) {
	const sr = ctx.sampleRate;
	const n = Math.floor(sr * seconds);
	const fade = Math.floor(sr * 0.5);
	const raw = new Float32Array(n + fade);
	let b = 0;
	let s = 12345;
	for (let i = 0; i < raw.length; i++) {
		s = (Math.imul(s, 1664525) + 1013904223) | 0;
		b = (b + 0.02 * ((s >>> 0) / 2147483648 - 1)) / 1.02;
		raw[i] = b * 3.5;
	}
	const buf = ctx.createBuffer(1, n, sr);
	const d = buf.getChannelData(0);
	for (let i = 0; i < n; i++) {
		d[i] = i < fade ? raw[i] * (i / fade) + raw[n + i] * (1 - i / fade) : raw[i];
	}
	return buf;
}

function ramp(param, to, secs, ctx) {
	const now = ctx.currentTime;
	param.cancelScheduledValues(now);
	param.setValueAtTime(param.value, now);
	param.linearRampToValueAtTime(to, now + Math.max(0.01, secs));
}

function lfo(ctx, period, depth, target, phaseSkip = 0) {
	const o = ctx.createOscillator();
	const g = ctx.createGain();
	o.frequency.value = 1 / period;
	g.gain.value = depth;
	o.connect(g);
	g.connect(target);
	o.start(ctx.currentTime + phaseSkip);
	return o;
}

export class ShoreAudio {
	constructor() {
		this._ctx = null;
		this._muted = false;
		this._failed = false;
		this._bedLevel = 1;
		this._buffers = new Map();
	}

	get started() { return !!this._ctx; }

	start() {
		if (this._ctx || this._failed) return;
		try {
			const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
			if (!AC) { this._failed = true; return; }
			const ctx = new AC();
			this._ctx = ctx;
			this._build(ctx);
			if (ctx.state === 'suspended') ctx.resume().catch(() => {});
			ramp(this._master.gain, 1, 4, ctx);
		} catch (err) {
			this._failed = true;
			this._ctx = null;
		}
	}

	_build(ctx) {
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -14;
		comp.knee.value = 12;
		comp.ratio.value = 6;
		comp.attack.value = 0.01;
		comp.release.value = 0.3;
		comp.connect(ctx.destination);
		const mute = ctx.createGain();
		mute.connect(comp);
		const master = ctx.createGain();
		master.gain.value = 0;
		master.connect(mute);
		this._mute = mute;
		this._master = master;

		// Bed
		const bed = ctx.createGain();
		bed.gain.value = this._bedLevel;
		bed.connect(master);
		this._bed = bed;

		const waves = ctx.createBufferSource();
		waves.buffer = brownBuffer(ctx, 6);
		waves.loop = true;
		const wlp = ctx.createBiquadFilter();
		wlp.type = 'lowpass';
		wlp.frequency.value = 380;
		const wg = ctx.createGain();
		wg.gain.value = 0.32;
		waves.connect(wlp);
		wlp.connect(wg);
		wg.connect(bed);
		waves.start();

		const wash = ctx.createBufferSource();
		wash.buffer = whiteBuffer(ctx);
		wash.loop = true;
		const whp = ctx.createBiquadFilter();
		whp.type = 'highpass';
		whp.frequency.value = 2500;
		const wbp = ctx.createBiquadFilter();
		wbp.type = 'lowpass';
		wbp.frequency.value = 7000;
		const washG = ctx.createGain();
		washG.gain.value = 0.012;
		wash.connect(whp);
		whp.connect(wbp);
		wbp.connect(washG);
		washG.connect(bed);
		wash.start();

		// Three unrelated swell periods drive cutoff, level and wash together.
		[[7, 160, 0.1, 0.004], [11, 120, 0.09, 0.003], [17, 90, 0.07, 0.003]].forEach(([period, fd, gd, wd], i) => {
			lfo(ctx, period, fd, wlp.frequency, i * 0.01);
			lfo(ctx, period, gd, wg.gain);
			lfo(ctx, period, wd, washG.gain);
		});

		// Wind
		const wind = ctx.createBufferSource();
		wind.buffer = whiteBuffer(ctx);
		wind.loop = true;
		const wbpf = ctx.createBiquadFilter();
		wbpf.type = 'bandpass';
		wbpf.Q.value = 2.5;
		wbpf.frequency.value = 500;
		const windG = ctx.createGain();
		windG.gain.value = 0.02;
		wind.connect(wbpf);
		wbpf.connect(windG);
		windG.connect(bed);
		wind.start();
		lfo(ctx, 23, 120, wbpf.frequency);
		lfo(ctx, 9.5, 80, wbpf.frequency);
		lfo(ctx, 13, 0.012, windG.gain);

		// Echo bus: distant lowpass plus a short feedback delay.
		const bus = ctx.createGain();
		const elp = ctx.createBiquadFilter();
		elp.type = 'lowpass';
		elp.frequency.value = 3500;
		bus.connect(elp);
		elp.connect(master);
		const delay = ctx.createDelay(1);
		delay.delayTime.value = 0.28;
		const fb = ctx.createGain();
		fb.gain.value = 0.25;
		const wet = ctx.createGain();
		wet.gain.value = 0.2;
		elp.connect(delay);
		delay.connect(fb);
		fb.connect(delay);
		delay.connect(wet);
		wet.connect(master);
		this._bus = bus;
		this._bedScale = BED_SCALE;
		bed.gain.value = this._bedLevel * BED_SCALE;
	}

	setMuted(muted) {
		this._muted = !!muted;
		if (!this._ctx) return;
		try { ramp(this._mute.gain, this._muted ? 0 : 1, 0.3, this._ctx); } catch (err) { /* ignore */ }
	}

	setBedLevel(level) {
		this._bedLevel = clamp(level, 0, 1);
		if (!this._ctx) return;
		try {
			const to = this._bedLevel * BED_SCALE;
			const now = this._ctx.currentTime;
			this._bed.gain.cancelScheduledValues(now);
			this._bed.gain.setValueAtTime(this._bed.gain.value, now);
			this._bed.gain.setTargetAtTime(to, now, 0.6);
		} catch (err) { /* ignore */ }
	}

	echo(fragment, { gain = 1, pan = 0 } = {}) {
		if (!this._ctx || this._muted) return 0;
		try {
			const echo = (fragment && fragment.echo) || {};
			const ctx = this._ctx;
			if (echo.file) {
				this._playFile(echo, gain, pan);
				const buf = this._buffers.get(echo.file);
				return buf ? buf.duration : 2.5; // estimate until the file is decoded
			}
			return this._playRecipe(echo, gain, pan, ctx.currentTime + 0.03);
		} catch (err) {
			return 0;
		}
	}

	_route(gain, pan) {
		const ctx = this._ctx;
		const g = ctx.createGain();
		g.gain.value = clamp(gain, 0, 1);
		let out = g;
		if (ctx.createStereoPanner) {
			const sp = ctx.createStereoPanner();
			sp.pan.value = clamp(pan, -1, 1);
			g.connect(sp);
			out = sp;
		}
		out.connect(this._bus);
		return g;
	}

	_playRecipe(echo, gain, pan, t0) {
		return playRecipe(this._ctx, this._route(gain, pan), echo.recipe, t0, { pitch: echo.pitch == null ? 1 : echo.pitch });
	}

	async _playFile(echo, gain, pan) {
		const ctx = this._ctx;
		try {
			let buf = this._buffers.get(echo.file);
			if (!buf) {
				const res = await fetch(echo.file);
				if (!res.ok) throw new Error('fetch failed');
				buf = await ctx.decodeAudioData(await res.arrayBuffer());
				this._buffers.set(echo.file, buf);
			}
			const src = ctx.createBufferSource();
			src.buffer = buf;
			if (echo.pitch) src.playbackRate.value = echo.pitch;
			src.connect(this._route(gain, pan));
			src.start();
		} catch (err) {
			if (this._ctx && !this._muted) this._playRecipe(echo, gain, pan, this._ctx.currentTime + 0.03);
		}
	}

	fadeOut(seconds) {
		if (!this._ctx) return;
		try { ramp(this._master.gain, 0, seconds, this._ctx); } catch (err) { /* ignore */ }
	}

	fadeIn(seconds) {
		if (!this._ctx) return;
		try { ramp(this._master.gain, 1, seconds, this._ctx); } catch (err) { /* ignore */ }
	}
}

// Bed gain that puts the continuous shore at about -18 dBFS peak (calibrated in a live context).
const BED_SCALE = 0.27;
