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

	it('halves at the very top and bottom edges of the hero band (sin(0)=sin(PI)=0)', () => {
		expect(
			cloudField(
				() => 1,
				() => 1,
				0,
				0,
				0,
				40
			)
		).toBeCloseTo(0.5, 5);
		expect(
			cloudField(
				() => 1,
				() => 1,
				0,
				40,
				0,
				40
			)
		).toBeCloseTo(0.5, 5);
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

	it('is zero below the 0.33-blend threshold, matching the legacy field', () => {
		expect(
			cloudField(
				() => 0.3,
				() => 0.3,
				0,
				20,
				0,
				40
			)
		).toBe(0);
	});
});
