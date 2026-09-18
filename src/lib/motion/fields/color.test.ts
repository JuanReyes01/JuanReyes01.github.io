import { describe, it, expect } from 'vitest';
import { mix, hotTraceRgb, rgbDistance, type Rgb } from './color';

describe('mix', () => {
	const black: [number, number, number] = [0, 0, 0];
	const white: [number, number, number] = [255, 255, 255];

	it('returns the first color unchanged at t=0', () => {
		expect(mix(black, white, 0)).toEqual([0, 0, 0]);
	});

	it('returns the second color unchanged at t=1', () => {
		expect(mix(black, white, 1)).toEqual([255, 255, 255]);
	});

	it('interpolates each channel independently and rounds to the nearest integer', () => {
		// Ported verbatim from the owner-approved header prototype's own
		// `mix()` — each channel rounds, matching a canvas fillStyle's own
		// integer channel precision.
		expect(mix([10, 20, 30], [20, 30, 44], 0.5)).toEqual([15, 25, 37]);
	});

	it('is a no-op when both colors are identical, regardless of t', () => {
		const a: [number, number, number] = [12, 34, 56];
		expect(mix(a, a, 0.5)).toEqual([12, 34, 56]);
		expect(mix(a, a, 0.9)).toEqual([12, 34, 56]);
	});

	it('does not clamp t — a caller passing t outside [0, 1] extrapolates linearly, matching the prototype', () => {
		expect(mix(black, white, 1.2)).toEqual([306, 306, 306]);
		expect(mix(black, white, -0.2)).toEqual([-51, -51, -51]);
	});
});

describe('hotTraceRgb', () => {
	// Regression: the poke used to swap to a flat `pink`, which is invisible
	// for a build whose own palette starts at pink — `amd:~90%` and
	// `opinion-corpus:100k+` both do.
	const DARK: Record<string, Rgb> = {
		cyan: [47, 224, 198],
		magenta: [176, 122, 245],
		yellow: [242, 201, 126],
		green: [126, 224, 140],
		blue: [90, 167, 245],
		pink: [242, 84, 119],
		fg: [232, 230, 240]
	};
	const LIGHT: Record<string, Rgb> = {
		cyan: [8, 115, 101],
		magenta: [112, 64, 196],
		yellow: [138, 93, 12],
		green: [40, 116, 53],
		blue: [40, 99, 176],
		pink: [186, 43, 81],
		fg: [18, 24, 41]
	};
	const PAIR_STARTS = ['cyan', 'green', 'magenta', 'blue', 'yellow', 'pink'];

	it.each([
		['dark', DARK],
		['light', LIGHT]
	])('is visibly different from the resting trace for every pair in the %s theme', (_t, tokens) => {
		for (const name of PAIR_STARTS) {
			const rest = tokens[name];
			const hot = hotTraceRgb(rest, tokens.fg);
			expect(
				rgbDistance(rest, hot),
				`${name}: the poke must change the trace's colour`
			).toBeGreaterThan(40);
		}
	});

	it('pulls the trace toward the foreground, not toward a fixed hue', () => {
		expect(hotTraceRgb(DARK.pink, DARK.fg)).toEqual(mix(DARK.pink, DARK.fg, 0.55));
		// Brighter in dark, darker in light — the direction follows the theme.
		expect(hotTraceRgb(DARK.pink, DARK.fg)[1]).toBeGreaterThan(DARK.pink[1]);
		expect(hotTraceRgb(LIGHT.pink, LIGHT.fg)[1]).toBeLessThan(LIGHT.pink[1]);
	});
});
