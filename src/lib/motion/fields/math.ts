/** Shared numeric helpers for the pure motion fields (design D1 boundary). */
export function clamp01(v: number): number {
	return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

/** RGB channels `0-255`, alpha `0-1` — the range `ImageData` stores per pixel
 * for RGB, but as a fraction (not a byte) for alpha. */
export interface Rgba {
	r: number;
	g: number;
	b: number;
	a: number;
}

/**
 * Standard "source-over" alpha compositing: paints `top` over `bottom`. Used
 * by the field band (design #4938 slice S2) to blend the hummingbird's
 * translucent parts over whatever the dither field already painted at that
 * pixel, instead of overwriting it outright — a fully transparent `top`
 * leaves `bottom` untouched, and a fully transparent `bottom` contributes
 * nothing (its RGB never reaches the result), so stale/uninitialized bottom
 * bytes behind a transparent pixel are always safe to pass in.
 */
export function blendOverRgba(top: Rgba, bottom: Rgba): Rgba {
	const outA = top.a + bottom.a * (1 - top.a);
	if (outA <= 0) return { r: 0, g: 0, b: 0, a: 0 };
	const mix = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / outA;
	return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: outA };
}
