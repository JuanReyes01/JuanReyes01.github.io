import { describe, it, expect } from 'vitest';
import { cloudField } from './clouds';

describe('cloudField', () => {
	it('is deterministic for the same samplers, position, time and height', () => {
		const a = (x: number) => (Math.sin(x) + 1) / 2;
		const b = (_x: number, y: number) => (Math.cos(y) + 1) / 2;
		expect(cloudField(a, b, 3, 4, 1.2, 40)).toBe(cloudField(a, b, 3, 4, 1.2, 40));
	});

	it('samples texture A at X*0.8+t*5, Y*0.8 and texture B at X*1.25-t*3, Y*1.25+t*1.5', () => {
		const calls: Array<{ which: string; x: number; y: number }> = [];
		const a = (x: number, y: number) => {
			calls.push({ which: 'a', x, y });
			return 0;
		};
		const b = (x: number, y: number) => {
			calls.push({ which: 'b', x, y });
			return 0;
		};
		cloudField(a, b, 10, 20, 2, 40);
		expect(calls).toEqual([
			{ which: 'a', x: 10 * 0.8 + 2 * 5, y: 20 * 0.8 },
			{ which: 'b', x: 10 * 1.25 - 2 * 3, y: 20 * 1.25 + 2 * 1.5 }
		]);
	});

	// Medium-intensity port (owner-approved header prototype v5): the vertical
	// fade changed from `0.5 + 0.5*sin` to `0.88 + 0.12*sin`, so the top/bottom
	// edges dim to 88% of the floor-adjusted peak instead of half of it —
	// coverage stays close to full everywhere instead of thinning at the
	// edges. 0.13 + 0.87*1*1*0.88 = 0.8956.
	it('dims to ~90% (not 50%) at the very top and bottom edges of the hero band (sin(0)=sin(PI)=0)', () => {
		expect(
			cloudField(
				() => 1,
				() => 1,
				0,
				0,
				0,
				40
			)
		).toBeCloseTo(0.8956, 4);
		expect(
			cloudField(
				() => 1,
				() => 1,
				0,
				40,
				0,
				40
			)
		).toBeCloseTo(0.8956, 4);
	});

	it('peaks near the vertical midpoint of the hero band', () => {
		const mid = cloudField(
			() => 1,
			() => 1,
			0,
			20,
			0,
			40
		);
		const nearTop = cloudField(
			() => 1,
			() => 1,
			0,
			2,
			0,
			40
		);
		expect(mid).toBeGreaterThan(nearTop);
	});

	it('stays within [0, 1] for out-of-range samples', () => {
		const v = cloudField(
			() => 5,
			() => -5,
			0,
			20,
			0,
			40
		);
		expect(v).toBeGreaterThanOrEqual(0);
		expect(v).toBeLessThanOrEqual(1);
	});

	// Medium-intensity port: a density FLOOR (0.13 + 0.87*v²) replaces the old
	// hard zero below the blend threshold, so no cell ever reads as fully
	// blank — coverage approaches 100% instead of leaving gaps.
	it('returns the density floor (0.13), not zero, below the 0.33-blend threshold', () => {
		expect(
			cloudField(
				() => 0.3,
				() => 0.3,
				0,
				20,
				0,
				40
			)
		).toBeCloseTo(0.13, 5);
	});
});
