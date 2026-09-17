import { describe, it, expect } from 'vitest';
import { BAYER_8X8, bayerThreshold, passesDither } from './dither';

describe('BAYER_8X8', () => {
	it('is the legacy 8x8 Bayer matrix, 64 distinct integers from 0 to 63', () => {
		expect(BAYER_8X8).toHaveLength(64);
		expect(new Set(BAYER_8X8).size).toBe(64);
		expect(Math.min(...BAYER_8X8)).toBe(0);
		expect(Math.max(...BAYER_8X8)).toBe(63);
	});

	it('matches the legacy matrix values at known indices', () => {
		expect(BAYER_8X8[0]).toBe(0);
		expect(BAYER_8X8[1]).toBe(32);
		expect(BAYER_8X8[9]).toBe(16);
		expect(BAYER_8X8[63]).toBe(21);
	});
});

describe('bayerThreshold', () => {
	it('maps each cell to `(BAYER_8X8[i] + 0.5) / 64`, tiled every 8 cells', () => {
		expect(bayerThreshold(0, 0)).toBeCloseTo((0 + 0.5) / 64);
		expect(bayerThreshold(1, 0)).toBeCloseTo((32 + 0.5) / 64);
		expect(bayerThreshold(8, 0)).toBeCloseTo(bayerThreshold(0, 0));
		expect(bayerThreshold(0, 8)).toBeCloseTo(bayerThreshold(0, 0));
	});

	it('stays strictly between 0 and 1 for every cell', () => {
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				const v = bayerThreshold(x, y);
				expect(v).toBeGreaterThan(0);
				expect(v).toBeLessThan(1);
			}
		}
	});
});

describe('passesDither', () => {
	it('lets a value through only when it clears the ordered-dither threshold for that cell', () => {
		const threshold = bayerThreshold(1, 0); // (32 + 0.5) / 64 ≈ 0.508
		expect(passesDither(threshold + 0.01, 1, 0)).toBe(true);
		expect(passesDither(threshold - 0.01, 1, 0)).toBe(false);
	});

	it('is a strict greater-than, matching the legacy `v > THRESH[...]` check', () => {
		const threshold = bayerThreshold(0, 0);
		expect(passesDither(threshold, 0, 0)).toBe(false);
	});
});
