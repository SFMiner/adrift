// Small seeded PRNG (mulberry32) and helpers. A run is reproducible from its seed.

export function makeRng(seed) {
	let a = seed >>> 0;
	return function rand() {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function randomSeed() {
	try {
		const a = new Uint32Array(1);
		crypto.getRandomValues(a);
		return a[0];
	} catch {
		return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
	}
}

export function randInt(rand, min, max) {
	return min + Math.floor(rand() * (max - min + 1));
}

export function shuffle(rand, list) {
	const a = list.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// Stable hash of a string or number to 0..1, for decoration that must not change between frames.
export function hash01(n) {
	let h = typeof n === 'number' ? Math.imul(n | 0, 2654435761) : 2166136261;
	if (typeof n === 'string') {
		for (let i = 0; i < n.length; i++) h = Math.imul(h ^ n.charCodeAt(i), 16777619);
	}
	h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
	return (h >>> 0) / 4294967296;
}
