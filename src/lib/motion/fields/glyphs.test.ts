import { describe, it, expect } from 'vitest';
import {
	sampleGradient,
	directionalGlyph,
	cornerResponse,
	pickGlyph,
	isCoherentEdge,
	densityGlyph,
	DENSITY_RAMP
} from './glyphs';

describe('sampleGradient', () => {
	it('recovers the exact gradient of a linear field (central differences are exact for linear fields)', () => {
		// f(x, y) = 2x + 3y -> grad = (2, 3) everywhere.
		const field = (x: number, y: number) => 2 * x + 3 * y;
		const { gx, gy, magnitude } = sampleGradient(field, 5, 7);
		expect(gx).toBeCloseTo(2);
		expect(gy).toBeCloseTo(3);
		expect(magnitude).toBeCloseTo(Math.hypot(2, 3));
	});

	it('reports zero gradient on a flat field', () => {
		const flat = () => 0.42;
		const { gx, gy, magnitude } = sampleGradient(flat, 3, 4);
		expect(gx).toBe(0);
		expect(gy).toBe(0);
		expect(magnitude).toBe(0);
	});
});

describe('directionalGlyph', () => {
	it('returns null below the threshold (flat area -> caller falls back to density)', () => {
		expect(directionalGlyph(0.05, 0.05, Math.hypot(0.05, 0.05), 0.5)).toBeNull();
	});

	// The edge TANGENT runs perpendicular to the gradient, so a horizontal
	// gradient (brightness changes left/right) traces a VERTICAL edge, and
	// vice versa. Table derived from the geometry of a circle: the gradient
	// is always radial, and the tangent bucket that results matches the
	// glyph a human would draw at that point on the circle's rim (see the
	// circle test below for the full worked derivation).
	const cases: Array<[number, number, string]> = [
		[2, 0, '|'], // horizontal gradient -> vertical edge
		[-2, 0, '|'],
		[0, 2, '-'], // vertical gradient -> horizontal edge
		[0, -2, '-'],
		[2, 2, '/'], // diagonal gradient -> counter-diagonal edge
		[-2, -2, '/'],
		[2, -2, '\\'],
		[-2, 2, '\\']
	];
	for (const [gx, gy, expected] of cases) {
		it(`buckets gradient (${gx}, ${gy}) as '${expected}'`, () => {
			const magnitude = Math.hypot(gx, gy);
			expect(directionalGlyph(gx, gy, magnitude, 1)).toBe(expected);
		});
	}
});

describe('cornerResponse', () => {
	it('is higher at a real right-angle junction than along a straight run of the same edge', () => {
		// An L-shaped step: 1 in the upper-right quadrant from (10,10), 0
		// elsewhere. This has a straight vertical edge along x=10 (for
		// y < 10) and a straight horizontal edge along y=10 (for x < 10),
		// meeting at a genuine corner at (10, 10).
		const field = (x: number, y: number) => (x >= 10 && y >= 10 ? 1 : 0);
		const corner = cornerResponse(field, 10, 10);
		const straightVertical = cornerResponse(field, 10, 3);
		const straightHorizontal = cornerResponse(field, 3, 10);
		expect(corner).toBeGreaterThan(straightVertical);
		expect(corner).toBeGreaterThan(straightHorizontal);
	});

	it('is ~zero on a flat field', () => {
		const flat = () => 0.5;
		expect(cornerResponse(flat, 5, 5)).toBeCloseTo(0);
	});
});

describe('pickGlyph', () => {
	it('falls back to the density ramp where the gradient is weak', () => {
		const flat = () => 0.5;
		const glyph = pickGlyph(flat, 5, 5, 0.5, { edgeThreshold: 0.1 });
		const expectedIndex = Math.round(0.5 * (DENSITY_RAMP.length - 1));
		expect(glyph).toBe(DENSITY_RAMP.charAt(expectedIndex));
	});

	it('traces a vertical step edge with "|" and keeps flat sides on the density ramp', () => {
		const step = (x: number) => (x >= 10 ? 1 : 0);
		const onEdge = pickGlyph(step, 10, 5, step(10), { edgeThreshold: 0.3 });
		expect(onEdge).toBe('|');
		const farLeft = pickGlyph(step, 2, 5, step(2), { edgeThreshold: 0.3 });
		expect(farLeft).toBe(DENSITY_RAMP.charAt(0));
		const farRight = pickGlyph(step, 18, 5, step(18), { edgeThreshold: 0.3 });
		expect(farRight).toBe(DENSITY_RAMP.charAt(DENSITY_RAMP.length - 1));
	});

	it('traces a horizontal step edge with "-"', () => {
		const step = (_x: number, y: number) => (y >= 10 ? 1 : 0);
		const onEdge = pickGlyph(step, 5, 10, step(5, 10), { edgeThreshold: 0.3 });
		expect(onEdge).toBe('-');
	});

	it('traces every compass point of a soft circle with the geometrically correct tangent glyph', () => {
		const cx = 20;
		const cy = 20;
		const r = 8;
		const k = 1.5;
		const circle = (x: number, y: number) => {
			const d = Math.hypot(x - cx, y - cy);
			return 1 / (1 + Math.exp((d - r) * k));
		};
		const opts = { edgeThreshold: 0.05 };
		// Cardinal points: top/bottom -> horizontal tangent, left/right -> vertical tangent.
		expect(pickGlyph(circle, cx, cy - r, circle(cx, cy - r), opts)).toBe('-'); // top
		expect(pickGlyph(circle, cx, cy + r, circle(cx, cy + r), opts)).toBe('-'); // bottom
		expect(pickGlyph(circle, cx - r, cy, circle(cx - r, cy), opts)).toBe('|'); // left
		expect(pickGlyph(circle, cx + r, cy, circle(cx + r, cy), opts)).toBe('|'); // right
		// Diagonal points: antipodal points share the same tangent orientation.
		const d = Math.round(r / Math.SQRT2);
		expect(pickGlyph(circle, cx + d, cy - d, circle(cx + d, cy - d), opts)).toBe('\\'); // upper-right
		expect(pickGlyph(circle, cx - d, cy + d, circle(cx - d, cy + d), opts)).toBe('\\'); // lower-left
		expect(pickGlyph(circle, cx + d, cy + d, circle(cx + d, cy + d), opts)).toBe('/'); // lower-right
		expect(pickGlyph(circle, cx - d, cy - d, circle(cx - d, cy - d), opts)).toBe('/'); // upper-left
		// Far from the rim (deep interior / far exterior): weak gradient -> density ramp.
		expect(pickGlyph(circle, cx, cy, circle(cx, cy), opts)).toBe(
			DENSITY_RAMP.charAt(DENSITY_RAMP.length - 1)
		);
		expect(pickGlyph(circle, cx + 30, cy, circle(cx + 30, cy), opts)).toBe(DENSITY_RAMP.charAt(0));
	});

	// Owner correction (site/v2-direction slice S3, apply-fix round 1):
	// "directional glyphs belong to shapes, not noise" — a uniform ramp
	// has the SAME gradient magnitude everywhere (no cell is a local peak
	// relative to its neighbors), so under the new coherence gate it no
	// longer counts as a "real edge" — every cell falls back to the
	// density ramp instead of tracing a false diagonal line through a
	// perfectly smooth gradient.
	it('does NOT trace a uniform ramp as an edge — no cell is a local peak, so it stays on the density ramp', () => {
		const ramp = (x: number, y: number) => x + y;
		const opts = { edgeThreshold: 0.5 };
		for (const [x, y] of [
			[0, 0],
			[3, 4],
			[10, -2]
		]) {
			expect(pickGlyph(ramp, x, y, 0, opts)).toBe(DENSITY_RAMP.charAt(0));
		}
	});

	it('picks the junction glyph "+" at a real corner, not along its straight edges', () => {
		const field = (x: number, y: number) => (x >= 10 && y >= 10 ? 1 : 0);
		const opts = { edgeThreshold: 0.2, cornerThreshold: 0.005 };
		expect(pickGlyph(field, 10, 10, field(10, 10), opts)).toBe('+');
		// Away from the corner, each arm of the "L" is a plain straight edge:
		// the vertical ray at x=10 (for y > 10) and the horizontal ray at
		// y=10 (for x > 10).
		expect(pickGlyph(field, 10, 15, field(10, 15), opts)).toBe('|');
		expect(pickGlyph(field, 15, 10, field(15, 10), opts)).toBe('-');
	});

	it('accepts a custom ramp string', () => {
		const flat = () => 1;
		expect(pickGlyph(flat, 0, 0, 1, { edgeThreshold: 0.1, ramp: ' .#' })).toBe('#');
	});

	// Owner correction (site/v2-direction slice S3, apply-fix round 1):
	// "applying pickGlyph's edge tracing to the ambient cloud/iridescent
	// field invents a direction in every cell, which is what produces the
	// random dashes and pipes" — a spatially uncorrelated noise field
	// (every cell's value is independent of its neighbors, unlike the
	// smooth value-noise the real engines sample) must yield ALMOST NO
	// directional glyphs, even though plenty of individual cells cross
	// edgeThreshold on their own.
	it('yields almost no directional glyphs on a spatially uncorrelated noise field, even though many cells individually cross edgeThreshold', () => {
		// Deterministic per-cell hash -> [0,1), completely uncorrelated
		// between neighboring cells (unlike real Perlin/value noise).
		const noise = (x: number, y: number): number => {
			const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
			return n - Math.floor(n);
		};
		const opts = { edgeThreshold: 0.15 };
		let edgeCount = 0;
		let total = 0;
		for (let y = 0; y < 30; y++) {
			for (let x = 0; x < 30; x++) {
				const glyph = pickGlyph(noise, x, y, noise(x, y), opts);
				if ('|/\\'.includes(glyph)) edgeCount++;
				total++;
			}
		}
		expect(edgeCount / total).toBeLessThan(0.1);
	});
});

describe('isCoherentEdge', () => {
	it('is true at a real step-function boundary (magnitude peaks there, direction is stable along the boundary)', () => {
		const step = (x: number) => (x >= 10 ? 1 : 0);
		expect(isCoherentEdge(step, 10, 5, { edgeThreshold: 0.3 })).toBe(true);
	});

	it('is true along a soft circle rim', () => {
		const cx = 20;
		const cy = 20;
		const r = 8;
		const k = 1.5;
		const circle = (x: number, y: number) => {
			const d = Math.hypot(x - cx, y - cy);
			return 1 / (1 + Math.exp((d - r) * k));
		};
		expect(isCoherentEdge(circle, cx, cy - r, { edgeThreshold: 0.05 })).toBe(true);
		expect(isCoherentEdge(circle, cx - r, cy, { edgeThreshold: 0.05 })).toBe(true);
	});

	it('is false deep inside a flat region (no gradient at all)', () => {
		const flat = () => 0.5;
		expect(isCoherentEdge(flat, 5, 5, { edgeThreshold: 0.1 })).toBe(false);
	});

	it('is false on a uniform ramp — magnitude never peaks relative to its neighbors', () => {
		const ramp = (x: number, y: number) => x + y;
		expect(isCoherentEdge(ramp, 5, 5, { edgeThreshold: 0.5 })).toBe(false);
	});

	it('is false at an isolated noise spike with no directionally-consistent neighbors', () => {
		// One cell is a sharp outlier; its neighbors are all flat and
		// share no consistent gradient direction with it or each other.
		const spike = (x: number, y: number) => (x === 5 && y === 5 ? 1 : 0);
		expect(isCoherentEdge(spike, 5, 5, { edgeThreshold: 0.1 })).toBe(false);
	});
});

describe('densityGlyph', () => {
	it('maps a value to the correct DENSITY_RAMP character by rounding to the nearest index', () => {
		expect(densityGlyph(0)).toBe(DENSITY_RAMP.charAt(0));
		expect(densityGlyph(1)).toBe(DENSITY_RAMP.charAt(DENSITY_RAMP.length - 1));
		const mid = Math.round(0.5 * (DENSITY_RAMP.length - 1));
		expect(densityGlyph(0.5)).toBe(DENSITY_RAMP.charAt(mid));
	});

	it('clamps out-of-range values instead of throwing or indexing out of bounds', () => {
		expect(densityGlyph(-5)).toBe(DENSITY_RAMP.charAt(0));
		expect(densityGlyph(5)).toBe(DENSITY_RAMP.charAt(DENSITY_RAMP.length - 1));
	});

	it('accepts a custom ramp string, same convention as pickGlyph', () => {
		expect(densityGlyph(1, ' .#')).toBe('#');
	});
});
