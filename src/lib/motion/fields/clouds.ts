import { clamp01 } from './math';

/**
 * The hero's ambient cloud field (design D1 boundary, motion table "Sky /":
 * "Clouds drift (today's speeds)"), ported verbatim from the legacy
 * `cloudField`. `X`/`Y` are cell-space pixel coordinates (grid column/row
 * scaled to a "unit" size, see `motion/engines/sky.ts`), `H` is the hero's
 * cell-space height — the `sin` term fades clouds out at the very top and
 * bottom of the band so they never look like they're clipping.
 */
export function cloudField(
	sampleA: (x: number, y: number) => number,
	sampleB: (x: number, y: number) => number,
	X: number,
	Y: number,
	t: number,
	H: number
): number {
	const a = sampleA(X * 0.8 + t * 5, Y * 0.8);
	const b = sampleB(X * 1.25 - t * 3, Y * 1.25 + t * 1.5);
	const v = clamp01((a * 0.65 + b * 0.35 - 0.33) / 0.38);
	return v * v * (0.5 + 0.5 * Math.sin(Math.PI * clamp01(Y / H)));
}
