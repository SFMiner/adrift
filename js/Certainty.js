// The resource. It has no name on screen and is never shown as a number: only as light.
import { CONFIG } from './config.js';
import { randInt } from './rng.js';

export function rollCertainty(rand, cfg = CONFIG) {
	return randInt(rand, cfg.CERTAINTY_MIN, cfg.CERTAINTY_MAX);
}

// The last answer is always affordable: a cost larger than what remains takes what remains.
export function spend(run, cost) {
	const taken = Math.min(run.certaintyLeft, Math.max(0, cost));
	run.certaintyLeft -= taken;
	return taken;
}

// 1 at the start of a run, 0 when nothing is left.
export function lightOf(run) {
	return run.certaintyStart > 0 ? run.certaintyLeft / run.certaintyStart : 0;
}

// What the world should look like for a given light level.
export function lightState(light, cfg = CONFIG) {
	const floor = cfg.ANCHORS_ONLY_AT_LEFT;
	return {
		light,
		// Ambient brightness of sand and water. Below the last threshold it falls away to nothing.
		ambient: light < floor ? (light / floor) * 0.14 : 0.14 + 0.86 * Math.pow((light - floor) / (1 - floor), 0.7),
		farWater: 1 - light >= cfg.FAR_WATER_GONE_AT_SPENT ? 0 : 1,
		warmth: light <= cfg.WARMTH_GONE_AT_LEFT ? 0 : 1,
		// Memories burn brighter as everything else goes.
		anchor: 0.55 + 0.9 * (1 - light),
	};
}
