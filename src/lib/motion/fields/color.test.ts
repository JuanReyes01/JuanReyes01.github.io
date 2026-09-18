import { describe, it, expect } from 'vitest';
import { mix } from './color';

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
