import { clamp01 } from './math';

/** Which lane-color token draws this cell's dot in the field band. */
export type IridescentInk = 'green' | 'cyan' | 'blue';

export interface IridescentSample {
	value: number;
	ink: IridescentInk;
}

/**
 * The field band's "protagonist" iridescent field (owner's explicit PR4
 * choice — a NEW, taller band, ported from the legacy pane-header
 * `iridescent` strip field but slowed down for ambient drift per design's
 * motion table). `samplePrimary`/`sampleShimmer` are texture lookups (the
 * caller supplies memoized noise textures — design D14); this function
 * itself stays pure so the field math is testable without a canvas.
 */
export function iridescentField(
	samplePrimary: (x: number, y: number) => number,
	sampleShimmer: (x: number, y: number) => number,
	x: number,
	y: number,
	t: number
): IridescentSample {
	const a = samplePrimary(x * 0.7 + t * 1.2, y * 0.5 - t * 0.4);
	const b = sampleShimmer(x * 1.8 - t * 2, y * 1.8);
	const raw = clamp01((a * 0.6 + b * 0.4 - 0.34) / 0.34);
	const value = raw * raw;
	const ink: IridescentInk = b > 0.7 && value > 0.6 ? 'blue' : b > 0.52 ? 'cyan' : 'green';
	return { value, ink };
}
