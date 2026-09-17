import { describe, it, expect } from 'vitest';
import { TEXTURE_SIZE, makeTexture, sampleTexture } from './noise';

describe('makeTexture', () => {
	it('is deterministic for a given seed', () => {
		const a = makeTexture(1337);
		const b = makeTexture(1337);
		expect(Array.from(a)).toEqual(Array.from(b));
	});

	it('produces a different texture for a different seed', () => {
		const a = makeTexture(1337);
		const b = makeTexture(90210);
		expect(Array.from(a)).not.toEqual(Array.from(b));
	});

	it('fills a TEXTURE_SIZE x TEXTURE_SIZE grid', () => {
		const t = makeTexture(1);
		expect(t.length).toBe(TEXTURE_SIZE * TEXTURE_SIZE);
	});

	it('stays within the [0, 1] range everywhere', () => {
		const t = makeTexture(42);
		for (let i = 0; i < t.length; i++) {
			expect(t[i]).toBeGreaterThanOrEqual(0);
			expect(t[i]).toBeLessThanOrEqual(1);
		}
	});
});

describe('sampleTexture', () => {
	it('reads the exact cell for in-range integer coordinates', () => {
		const t = makeTexture(1337);
		expect(sampleTexture(t, 5, 9)).toBe(t[9 * TEXTURE_SIZE + 5]);
	});

	it('tiles periodically past the texture edge', () => {
		const t = makeTexture(1337);
		expect(sampleTexture(t, TEXTURE_SIZE + 5, 9)).toBe(sampleTexture(t, 5, 9));
		expect(sampleTexture(t, 5, TEXTURE_SIZE * 2 + 9)).toBe(sampleTexture(t, 5, 9));
	});

	it('tiles for negative coordinates the same way the legacy `& 255` mask did', () => {
		const t = makeTexture(1337);
		// `(-1) & 255 === 255` in JS bitwise semantics — mirror that exactly.
		expect(sampleTexture(t, -1, 0)).toBe(sampleTexture(t, TEXTURE_SIZE - 1, 0));
	});

	it('floors fractional coordinates before wrapping', () => {
		const t = makeTexture(1337);
		expect(sampleTexture(t, 5.9, 9.2)).toBe(sampleTexture(t, 5, 9));
	});
});
