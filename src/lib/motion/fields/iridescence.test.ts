import { describe, it, expect } from 'vitest';
import { iridescentField } from './iridescence';

describe('iridescentField', () => {
	it('is deterministic for the same samplers, position and time', () => {
		const primary = (x: number, y: number) => (Math.sin(x) + Math.cos(y) + 2) / 4;
		const shimmer = (x: number, y: number) => (Math.cos(x) + Math.sin(y) + 2) / 4;
		const a = iridescentField(primary, shimmer, 3, 4, 1.2);
		const b = iridescentField(primary, shimmer, 3, 4, 1.2);
		expect(a).toEqual(b);
	});

	it('samples the primary field at x*0.7+t*1.2, y*0.5-t*0.4 and the shimmer at x*1.8-t*2, y*1.8', () => {
		const calls: Array<{ which: string; x: number; y: number }> = [];
		const primary = (x: number, y: number) => {
			calls.push({ which: 'primary', x, y });
			return 0;
		};
		const shimmer = (x: number, y: number) => {
			calls.push({ which: 'shimmer', x, y });
			return 0;
		};
		iridescentField(primary, shimmer, 10, 20, 5);
		expect(calls).toEqual([
			{ which: 'primary', x: 10 * 0.7 + 5 * 1.2, y: 20 * 0.5 - 5 * 0.4 },
			{ which: 'shimmer', x: 10 * 1.8 - 5 * 2, y: 20 * 1.8 }
		]);
	});

	it('is green when the shimmer sample stays at or below 0.52', () => {
		const { ink } = iridescentField(
			() => 0.5,
			() => 0.52,
			0,
			0,
			0
		);
		expect(ink).toBe('green');
	});

	it('is cyan once the shimmer sample exceeds 0.52 but value stays low', () => {
		const { ink } = iridescentField(
			() => 0,
			() => 0.53,
			0,
			0,
			0
		);
		expect(ink).toBe('cyan');
	});

	it('is blue only once shimmer exceeds 0.70 AND value exceeds 0.6', () => {
		const high = iridescentField(
			() => 1,
			() => 0.71,
			0,
			0,
			0
		);
		expect(high.value).toBeGreaterThan(0.6);
		expect(high.ink).toBe('blue');
	});

	it('stays cyan when shimmer exceeds 0.70 but value does not clear 0.6', () => {
		const { ink, value } = iridescentField(
			() => 0,
			() => 0.71,
			0,
			0,
			0
		);
		expect(value).toBeLessThanOrEqual(0.6);
		expect(ink).toBe('cyan');
	});

	it('computes value as clamp01((a*0.6+b*0.4-0.34)/0.34) squared', () => {
		const a = 0.8;
		const b = 0.6;
		const { value } = iridescentField(
			() => a,
			() => b,
			0,
			0,
			0
		);
		const raw = Math.max(0, Math.min(1, (a * 0.6 + b * 0.4 - 0.34) / 0.34));
		expect(value).toBeCloseTo(raw * raw);
	});

	it('clamps value to [0, 1] even for out-of-range samples', () => {
		const { value } = iridescentField(
			() => 5,
			() => 5,
			0,
			0,
			0
		);
		expect(value).toBeLessThanOrEqual(1);
		expect(value).toBeGreaterThanOrEqual(0);
	});
});
