import { describe, it, expect } from 'vitest';
import { staticFieldRows } from './static-field';
import { DENSITY_RAMP } from './glyphs';

describe('staticFieldRows', () => {
	it('returns exactly `rows` strings, each exactly `cols` characters long', () => {
		const rows = staticFieldRows(40, 6);
		expect(rows).toHaveLength(6);
		for (const row of rows) expect(row).toHaveLength(40);
	});

	it('is deterministic — same size produces the exact same field every time (build-time, no JS)', () => {
		const a = staticFieldRows(60, 8).join('\n');
		const b = staticFieldRows(60, 8).join('\n');
		expect(a).toBe(b);
	});

	it('produces a DIFFERENT field for a different size (not a constant string)', () => {
		const a = staticFieldRows(60, 8).join('\n');
		const b = staticFieldRows(80, 10).join('\n');
		expect(a).not.toBe(b);
	});

	// Owner correction (site/v2-direction slice S3, apply-fix round 1):
	// "ambient fields use the density ramp only" — this cloud field is
	// procedural noise with no real shape to trace, so it must never
	// produce a directional edge glyph.
	it('never produces a directional edge glyph — density ramp only', () => {
		const text = staticFieldRows(90, 12).join('');
		const edgeGlyphs = [...text].filter((c) => '|/\\'.includes(c));
		const densityGlyphs = [...text].filter((c) => c !== ' ' && DENSITY_RAMP.includes(c));
		expect(edgeGlyphs.length).toBe(0);
		expect(densityGlyphs.length).toBeGreaterThan(0);
	});

	it('leaves at least some cells blank (not a fully solid block of characters)', () => {
		const text = staticFieldRows(90, 12).join('');
		const blanks = [...text].filter((c) => c === ' ').length;
		expect(blanks).toBeGreaterThan(0);
	});
});
