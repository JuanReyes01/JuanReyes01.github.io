import { describe, it, expect } from 'vitest';
import {
	sampleGradient,
	directionalGlyph,
	cornerResponse,
	pickGlyph,
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

	it('renders a uniform diagonal ramp with one consistent diagonal glyph (no false edges elsewhere)', () => {
		const ramp = (x: number, y: number) => x + y;
		const opts = { edgeThreshold: 0.5 };
		for (const [x, y] of [
			[0, 0],
			[3, 4],
			[10, -2]
		]) {
			expect(pickGlyph(ramp, x, y, 0, opts)).toBe('/');
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
});
