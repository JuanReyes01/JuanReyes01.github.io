import { describe, it, expect } from 'vitest';
import { blendOverRgba, clamp, clamp01 } from './math';

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

describe('blendOverRgba', () => {
	it('is a no-op when painting a fully opaque color over anything', () => {
		const top = { r: 10, g: 20, b: 30, a: 1 };
		const bottom = { r: 200, g: 200, b: 200, a: 1 };
		expect(blendOverRgba(top, bottom)).toEqual({ r: 10, g: 20, b: 30, a: 1 });
	});

	it('passes a fully transparent top straight through to the bottom color', () => {
		const top = { r: 10, g: 20, b: 30, a: 0 };
		const bottom = { r: 200, g: 150, b: 100, a: 1 };
		expect(blendOverRgba(top, bottom)).toEqual({ r: 200, g: 150, b: 100, a: 1 });
	});

	it('ignores the bottom color entirely when it is fully transparent (the field band drawing an unlit cell)', () => {
		const top = { r: 10, g: 20, b: 30, a: 0.78 };
		const bottom = { r: 255, g: 255, b: 255, a: 0 };
		const result = blendOverRgba(top, bottom);
		expect(result.r).toBeCloseTo(10);
		expect(result.g).toBeCloseTo(20);
		expect(result.b).toBeCloseTo(30);
		expect(result.a).toBeCloseTo(0.78);
	});

	it('mixes a translucent top over an opaque bottom, proving the wing lets the band show through (design #4938 slice S2)', () => {
		const top = { r: 0, g: 0, b: 0, a: 0.5 };
		const bottom = { r: 200, g: 200, b: 200, a: 1 };
		const result = blendOverRgba(top, bottom);
		expect(result.a).toBeCloseTo(1);
		expect(result.r).toBeCloseTo(100);
		expect(result.g).toBeCloseTo(100);
		expect(result.b).toBeCloseTo(100);
	});
});
