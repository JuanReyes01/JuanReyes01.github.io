/**
 * The hero's pointer/touch ripple wave buffer (design D1 boundary, motion
 * table "Sky /": "Pointer/touch ripple"), ported verbatim from the legacy
 * `Sky.prototype.poke`/`stepRipple` pair. Coordinates are grid cells, not
 * client pixels — converting a pointer event to a cell is the DOM-dependent
 * part and lives in `motion/actions/sky.ts`.
 */

/** Medium-intensity port (owner-approved header prototype v5): every 2D
 * pointer/touch ripple is scaled by this gain before landing in the buffer —
 * ported verbatim from the prototype's own `RIPPLE_GAIN` (its intensity
 * control itself is not shipped, so "medium", multiplier 1, is hard-coded as
 * this single constant). */
const RIPPLE_GAIN = 2.4;

/**
 * Adds wave energy at `(cellX, cellY)` and its 8 neighbors (full strength at
 * the center, half strength around it), skipping any cell that would land
 * on the buffer's 1px border — mirrors the legacy bounds guard exactly.
 * `strength` is gained by {@link RIPPLE_GAIN} before it's applied.
 */
export function pokeRipple(
	buffer: Float32Array,
	cols: number,
	rows: number,
	cellX: number,
	cellY: number,
	strength: number
): void {
	const gained = strength * RIPPLE_GAIN;
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			const x = cellX + dx;
			const y = cellY + dy;
			if (x < 1 || y < 1 || x >= cols - 1 || y >= rows - 1) continue;
			buffer[y * cols + x] += gained * (dx === 0 && dy === 0 ? 1 : 0.5);
		}
	}
}

/**
 * Advances the ripple simulation by one step: a discrete 2D wave equation
 * (`(neighbor average * 0.5 - previous value) * damping`), computed into a
 * fresh buffer rather than mutating `previous` in place (the legacy engine
 * reused its scratch array; this stays non-mutating so tests never need to
 * worry about aliasing). The 1px border is never written and stays `0`.
 */
export function stepRipple(
	cols: number,
	rows: number,
	current: Float32Array,
	previous: Float32Array
): { next: Float32Array; prev: Float32Array } {
	const next = new Float32Array(current.length);
	for (let y = 1; y < rows - 1; y++) {
		for (let x = 1; x < cols - 1; x++) {
			const i = y * cols + x;
			const neighborAvg =
				(current[i - 1] + current[i + 1] + current[i - cols] + current[i + cols]) * 0.5;
			next[i] = (neighborAvg - previous[i]) * 0.94;
		}
	}
	return { next, prev: current };
}
