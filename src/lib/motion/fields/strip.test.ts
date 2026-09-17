import { describe, it, expect } from 'vitest';
import { stripDots } from './strip';

describe('stripDots', () => {
	it('returns a rows x cols boolean grid at the requested size', () => {
		const grid = stripDots(12, 4);
		expect(grid).toHaveLength(4);
		for (const row of grid) expect(row).toHaveLength(12);
	});

	it('is deterministic — same size in, same pattern out (a static, server-renderable frame, design R2)', () => {
		const a = stripDots(24, 6);
		const b = stripDots(24, 6);
		expect(a).toEqual(b);
	});

	it('is non-degenerate: a strip this size has both lit and unlit cells, not a solid block or a blank one', () => {
		const grid = stripDots(48, 10);
		const flat = grid.flat();
		expect(flat.some((cell) => cell)).toBe(true);
		expect(flat.some((cell) => !cell)).toBe(true);
	});

	it('every cell is a plain boolean (no ink/color — the caller colors the whole strip via CSS, design R2 "in the section colour")', () => {
		const grid = stripDots(8, 2);
		for (const row of grid) {
			for (const cell of row) expect(typeof cell).toBe('boolean');
		}
	});
});
