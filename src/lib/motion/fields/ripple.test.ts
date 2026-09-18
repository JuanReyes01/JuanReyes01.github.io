import { describe, it, expect } from 'vitest';
import { pokeRipple, stepRipple } from './ripple';

describe('pokeRipple', () => {
	// Medium-intensity port (owner-approved header prototype v5): every poke
	// is scaled by a RIPPLE_GAIN of 2.4 before it lands in the buffer — the
	// intensity control itself is not shipped, so "medium" (multiplier 1) is
	// hard-coded as this gain living inside `pokeRipple`, same as the
	// prototype's own `s = strength * RIPPLE_GAIN * I.ripple`.
	it('gains the incoming strength by 2.4 before adding it: full strength at center, half of the gained amount at its 8 neighbors', () => {
		const cols = 5;
		const rows = 5;
		const buf = new Float32Array(cols * rows);
		pokeRipple(buf, cols, rows, 2, 2, 10);

		expect(buf[2 * cols + 2]).toBeCloseTo(24); // center: 10 * 2.4
		expect(buf[2 * cols + 1]).toBeCloseTo(12); // west: half of 24
		expect(buf[2 * cols + 3]).toBeCloseTo(12); // east
		expect(buf[1 * cols + 2]).toBeCloseTo(12); // north
		expect(buf[1 * cols + 1]).toBeCloseTo(12); // NW corner of the 3x3
	});

	it('ignores neighbors that would land on the 1px border, matching the legacy guard', () => {
		const cols = 5;
		const rows = 5;
		const buf = new Float32Array(cols * rows);
		pokeRipple(buf, cols, rows, 1, 1, 10); // one cell in from the top-left border
		// x=0 or y=0 neighbors must be skipped entirely (legacy: `x < 1 || y < 1 ... continue`).
		expect(buf[0 * cols + 0]).toBe(0);
		expect(buf[0 * cols + 1]).toBe(0);
		expect(buf[1 * cols + 0]).toBe(0);
		// the in-bounds neighbors still get poked, gained by 2.4.
		expect(buf[1 * cols + 1]).toBeCloseTo(24);
		expect(buf[1 * cols + 2]).toBeCloseTo(12);
	});

	it('accumulates across repeated (gained) pokes instead of overwriting', () => {
		const cols = 5;
		const rows = 5;
		const buf = new Float32Array(cols * rows);
		pokeRipple(buf, cols, rows, 2, 2, 10);
		pokeRipple(buf, cols, rows, 2, 2, 4);
		expect(buf[2 * cols + 2]).toBeCloseTo(24 + 4 * 2.4); // 33.6
	});
});

describe('stepRipple', () => {
	it('computes each interior cell as (neighbor average * 0.5 - previous) * 0.94', () => {
		const cols = 3;
		const rows = 3;
		// Only the single interior cell (1,1) is ever updated on a 3x3 grid.
		const current = new Float32Array(9);
		current[1 * cols + 0] = 4; // west of (1,1)
		current[1 * cols + 2] = 2; // east of (1,1)
		current[0 * cols + 1] = 6; // north of (1,1)
		current[2 * cols + 1] = 0; // south of (1,1)
		const previous = new Float32Array(9);
		previous[1 * cols + 1] = 1;

		const { next, prev } = stepRipple(cols, rows, current, previous);
		const expected = ((4 + 2 + 6 + 0) * 0.5 - 1) * 0.94;
		expect(next[1 * cols + 1]).toBeCloseTo(expected);
		expect(prev).toBe(current); // the old "current" becomes the new "previous" (buffer swap)
	});

	it('leaves the 1px border at zero, matching the legacy loop bounds', () => {
		const cols = 4;
		const rows = 4;
		const current = new Float32Array(16).fill(5);
		const previous = new Float32Array(16).fill(1);
		const { next } = stepRipple(cols, rows, current, previous);
		for (let x = 0; x < cols; x++) {
			expect(next[0 * cols + x]).toBe(0);
			expect(next[(rows - 1) * cols + x]).toBe(0);
		}
		for (let y = 0; y < rows; y++) {
			expect(next[y * cols + 0]).toBe(0);
			expect(next[y * cols + (cols - 1)]).toBe(0);
		}
	});

	it('decays a still pond toward zero via the 0.94 damping factor', () => {
		const cols = 3;
		const rows = 3;
		const current = new Float32Array(9); // flat pond, no wave energy anywhere
		const previous = new Float32Array(9);
		previous[1 * cols + 1] = 2;
		const { next } = stepRipple(cols, rows, current, previous);
		expect(next[1 * cols + 1]).toBeCloseTo((0 - 2) * 0.94);
	});
});
