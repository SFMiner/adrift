// Small DOM helpers shared by the screens.

export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, cls = '', text = '') {
	const node = document.createElement(tag);
	if (cls) node.className = cls;
	if (text) node.textContent = text;
	return node;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function showScreen(id, on = true) {
	const node = document.getElementById(id);
	if (node) node.classList.toggle('active', on);
}

// Press and hold to commit. Releasing early does nothing: that is the only "are you sure" the game has.
// getMs() is read at press time so debug runs can shorten it. onDone fires once per completed hold.
export function holdToConfirm(node, getMs, onDone, onProgress = null) {
	let start = 0;
	let raf = 0;
	let active = false;

	const set = (p) => {
		node.style.setProperty('--hold', p.toFixed(3));
		if (onProgress) onProgress(p);
	};
	const stop = () => {
		if (!active) return;
		active = false;
		cancelAnimationFrame(raf);
		node.classList.remove('holding');
		set(0);
	};
	const tick = () => {
		if (!active) return;
		const p = clamp((performance.now() - start) / getMs(), 0, 1);
		set(p);
		if (p >= 1) {
			active = false;
			node.classList.remove('holding');
			onDone();
			return;
		}
		raf = requestAnimationFrame(tick);
	};
	const begin = () => {
		if (active || node.disabled) return;
		active = true;
		start = performance.now();
		node.classList.add('holding');
		raf = requestAnimationFrame(tick);
	};

	node.addEventListener('pointerdown', (e) => {
		if (e.button !== undefined && e.button !== 0) return;
		begin();
	});
	for (const type of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) node.addEventListener(type, stop);
	node.addEventListener('keydown', (e) => {
		if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); begin(); }
	});
	node.addEventListener('keyup', (e) => {
		if (e.key === 'Enter' || e.key === ' ') stop();
	});
	node.addEventListener('click', (e) => e.preventDefault());
	node.addEventListener('contextmenu', (e) => e.preventDefault());
	return stop;
}
