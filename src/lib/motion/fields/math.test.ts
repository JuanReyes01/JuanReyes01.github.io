import { describe, it, expect } from 'vitest';
import { clamp, clamp01 } from './math';

describe('clamp01', () => {
	it('passes values already inside [0, 1] through unchanged', () => {
		expect(clamp01(0.42)).toBe(0.42);
	});

	it('clamps below 0 up to 0 and above 1 down to 1', () => {
		expect(clamp01(-3)).toBe(0);
		expect(clamp01(3)).toBe(1);
	});
});

describe('clamp', () => {
	it('clamps to an arbitrary [lo, hi] range', () => {
		expect(clamp(5, 0, 10)).toBe(5);
		expect(clamp(-1, 0, 10)).toBe(0);
		expect(clamp(11, 0, 10)).toBe(10);
	});
});
