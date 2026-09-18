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
