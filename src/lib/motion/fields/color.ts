/**
 * A tiny RGB interpolation helper (design D1 boundary: pure, DOM-free) for
 * the per-build waveform palette (owner decision `site/v2-direction` slice
 * S3, item D — approved header prototype port): every layer of the
 * waveform's "per build" study — the ambient field, the body band, the
 * trace — mixes between a build's own two palette tokens instead of
 * picking one flat color, so the whole header reads as shades of the same
 * two hues rather than a patchwork.
 *
 * Ported verbatim from the prototype's own `mix()`: it does not clamp `t`
 * (a caller passing something outside `[0, 1]` extrapolates linearly, same
 * as the prototype), and each channel rounds to the nearest integer,
 * matching a canvas `fillStyle`'s own integer channel precision.
 */
export type Rgb = readonly [number, number, number];

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
	return [
		Math.round(a[0] + (b[0] - a[0]) * t),
		Math.round(a[1] + (b[1] - a[1]) * t),
		Math.round(a[2] + (b[2] - a[2]) * t)
	];
}

/**
 * The colour a poked waveform column takes while the pointer's ripple energy
 * is still running through it.
 *
 * It used to be a flat swap to the `pink` token, which worked until builds
 * started choosing their own palette: a build whose pair STARTS at pink drew
 * its resting trace in exactly the colour the poke was supposed to change it
 * to, so dragging the header produced no visible colour change at all. Two of
 * the site's five builds land on that pair.
 *
 * Deriving the hot colour from the trace's own resting colour fixes the whole
 * family at once: the poke pulls the trace toward the page's foreground —
 * brighter in the dark theme, darker in the light one — so every pair, in
 * both themes, visibly reacts.
 */
export function hotTraceRgb(rest: Rgb, fg: Rgb): Rgb {
	return mix(rest, fg, 0.55);
}

/** Euclidean RGB distance — how far apart two colours read, used to hold the
    poke's own feedback to a visible minimum in tests. */
export function rgbDistance(a: Rgb, b: Rgb): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
