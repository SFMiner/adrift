// localStorage wrapper. Itch.io runs the game in a cross-origin iframe where storage can be blocked,
// so every call is guarded and falls back to memory for the length of the visit.

const memory = new Map();
let usable = null;

function storage() {
	if (usable === false) return null;
	try {
		const s = window.localStorage;
		if (usable === null) {
			s.setItem('adrift.probe', '1');
			s.removeItem('adrift.probe');
			usable = true;
		}
		return s;
	} catch {
		usable = false;
		return null;
	}
}

export const store = {
	get persistent() { return storage() !== null; },

	get(key, fallback = null) {
		try {
			const s = storage();
			const raw = s ? s.getItem(key) : memory.get(key);
			if (raw === null || raw === undefined) return fallback;
			return JSON.parse(raw);
		} catch {
			return fallback;
		}
	},

	set(key, value) {
		const raw = JSON.stringify(value);
		try {
			const s = storage();
			if (s) { s.setItem(key, raw); return; }
		} catch { /* quota or blocked: keep it in memory */ }
		memory.set(key, raw);
	},

	remove(key) {
		try {
			const s = storage();
			if (s) s.removeItem(key);
		} catch { /* ignore */ }
		memory.delete(key);
	},
};

export const KEYS = {
	RUN: 'adrift.run.v1',			// the run in progress
	GALLERY: 'adrift.gallery.v1',	// finished runs: [{ symbol, point, t }]
	HINTS: 'adrift.hints.v1',		// how many times each control hint has been shown
};
