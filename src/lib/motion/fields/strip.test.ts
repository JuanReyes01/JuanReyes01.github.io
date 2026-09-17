import { describe, it, expect } from 'vitest';
import { stripDots, stripPath } from './strip';
import { makeTexture, sampleTexture } from './noise';
import { iridescentField } from './iridescence';
import { passesDither } from './dither';

// Matches strip.ts's own fixed seeds/phase exactly, so the test below can
// recompute the exact expected per-cell value independently and compare —
// the two textures are expensive-ish to build (memoized once here, like
// strip.ts memoizes its own copies at module scope).
const texturePrimary = makeTexture(90210);
const textureShimmer = makeTexture(1337);
const STATIC_T = 4.2;

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

	it('applies scanline dimming exactly like legacy: value * (0.7 on odd rows, 1 on even rows) before the dither threshold', () => {
		// Direct formula check (not a statistical one): the classic 8x8 Bayer
		// matrix already assigns systematically higher thresholds to its own
		// odd rows (part of how ordered dithering distributes "on" pixels), so
		// a real content grid can easily have zero already-lit odd-row cells
		// to "flip" in a small sample — that would make a flip-counting test
		// flaky by field-content coincidence, not by a real regression. Instead
		// this recomputes the exact expected value per cell and compares.
		const cols = 30;
		const rows = 6;
		const grid = stripDots(cols, rows);
		for (let y = 0; y < rows; y++) {
			const scanline = y % 2 === 1 ? 0.7 : 1;
			for (let x = 0; x < cols; x++) {
				const { value } = iridescentField(
					(sx, sy) => sampleTexture(texturePrimary, sx, sy),
					(sx, sy) => sampleTexture(textureShimmer, sx, sy),
					x,
					y,
					STATIC_T
				);
				expect(grid[y][x]).toBe(passesDither(value * scanline, x, y));
			}
		}
	});

	it('the classic Bayer matrix already skews lit cells toward even rows — scanline dimming only ever makes odd rows darker still, never lighter', () => {
		// Sanity guard on the reasoning above: confirms odd rows are not
		// lighting up MORE than even rows once dimming is applied — protects
		// against a sign error (e.g. dimming even rows instead of odd ones).
		const grid = stripDots(200, 20);
		let evenLit = 0;
		let oddLit = 0;
		for (let y = 0; y < grid.length; y++) {
			const lit = grid[y].filter(Boolean).length;
			if (y % 2 === 0) evenLit += lit;
			else oddLit += lit;
		}
		expect(oddLit).toBeLessThan(evenLit);
	});
});

describe('stripPath', () => {
	it('emits one tiny square path segment per lit cell, matching stripDots exactly', () => {
		const cols = 16;
		const rows = 6;
		const grid = stripDots(cols, rows);
		const litCount = grid.flat().filter(Boolean).length;
		const d = stripPath(cols, rows);
		expect(d.match(/M/g)?.length ?? 0).toBe(litCount);
	});

	it('is a single compact path string — integer coordinates, no wasted precision', () => {
		const d = stripPath(20, 8);
		expect(d).toMatch(/^(M-?\d+ -?\d+h1v1h-1z)*$/);
	});

	it('is deterministic, matching stripDots', () => {
		expect(stripPath(30, 10)).toBe(stripPath(30, 10));
	});

	it('places each square at its cell’s integer grid position', () => {
		const grid = stripDots(10, 4);
		const d = stripPath(10, 4);
		for (let y = 0; y < grid.length; y++) {
			for (let x = 0; x < grid[y].length; x++) {
				if (grid[y][x]) expect(d).toContain(`M${x} ${y}h1v1h-1z`);
			}
		}
	});
});
