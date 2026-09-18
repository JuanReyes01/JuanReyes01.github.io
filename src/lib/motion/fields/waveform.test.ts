import { describe, it, expect } from 'vitest';
import {
	hashString,
	deriveWaveSignature,
	sampleWaveform,
	pokeWave1D,
	stepWave1D
} from './waveform';

describe('hashString', () => {
	it('is deterministic — the same string always hashes the same', () => {
		expect(hashString('creditbay')).toBe(hashString('creditbay'));
	});

	it('produces different hashes for different strings', () => {
		expect(hashString('creditbay')).not.toBe(hashString('amd'));
	});

	it('is sensitive to the whole string, not just its length (two 3-char strings differ)', () => {
		expect(hashString('abc')).not.toBe(hashString('xyz'));
	});
});

describe('deriveWaveSignature', () => {
	it('is deterministic — the same seed text always produces the same signature', () => {
		const a = deriveWaveSignature('creditbay:20 → 600');
		const b = deriveWaveSignature('creditbay:20 → 600');
		expect(a).toEqual(b);
	});

	it('derives a genuinely different signature for a different build (owner: "derived from that build\'s metric or slug")', () => {
		const creditbay = deriveWaveSignature('creditbay:20 → 600');
		const amd = deriveWaveSignature('amd:~90%');
		// At least one of the 3 dimensions must differ — proves this is a
		// real per-build mapping, not a constant fallback.
		const differs =
			creditbay.amplitude !== amd.amplitude ||
			creditbay.frequency !== amd.frequency ||
			creditbay.waveCount !== amd.waveCount;
		expect(differs).toBe(true);
	});

	it('keeps every dimension within its documented, sane range', () => {
		for (const seed of [
			'creditbay:20 → 600',
			'amd:~90%',
			'credit-brain:10',
			'opinion-corpus:100k+'
		]) {
			const sig = deriveWaveSignature(seed);
			expect(sig.amplitude).toBeGreaterThanOrEqual(0.2);
			expect(sig.amplitude).toBeLessThanOrEqual(0.85);
			expect(sig.frequency).toBeGreaterThanOrEqual(1);
			expect(sig.frequency).toBeLessThanOrEqual(4.5);
			expect(Number.isInteger(sig.waveCount)).toBe(true);
			expect(sig.waveCount).toBeGreaterThanOrEqual(1);
			expect(sig.waveCount).toBeLessThanOrEqual(4);
		}
	});

	it('changing only the metric half of the seed still changes the signature (metric contributes, not just the slug)', () => {
		const a = deriveWaveSignature('creditbay:20 → 600');
		const b = deriveWaveSignature('creditbay:999 → 1');
		const differs =
			a.amplitude !== b.amplitude || a.frequency !== b.frequency || a.waveCount !== b.waveCount;
		expect(differs).toBe(true);
	});
});

describe('sampleWaveform', () => {
	const sig = { amplitude: 0.5, frequency: 2, waveCount: 2 };

	it('is deterministic for the same (x, signature, t)', () => {
		expect(sampleWaveform(0.3, sig, 5)).toBe(sampleWaveform(0.3, sig, 5));
	});

	it("stays within the signature's own amplitude bound (a build's wave never blows past its own height)", () => {
		for (let i = 0; i <= 20; i++) {
			const x = i / 20;
			const v = sampleWaveform(x, sig, 12.34);
			expect(Math.abs(v)).toBeLessThanOrEqual(sig.amplitude + 1e-9);
		}
	});

	it('a higher amplitude signature produces a taller wave at the same phase', () => {
		const low = sampleWaveform(0.15, { amplitude: 0.2, frequency: 2, waveCount: 1 }, 0);
		const high = sampleWaveform(0.15, { amplitude: 0.8, frequency: 2, waveCount: 1 }, 0);
		expect(Math.abs(high)).toBeGreaterThan(Math.abs(low));
	});

	it('changes over time t (it animates, not a frozen shape)', () => {
		const a = sampleWaveform(0.3, sig, 0);
		const b = sampleWaveform(0.3, sig, 3);
		expect(a).not.toBe(b);
	});
});

describe('pokeWave1D', () => {
	it('adds full-strength energy at the center index and half-strength at its neighbors', () => {
		const buf = new Float32Array(10);
		pokeWave1D(buf, 10, 5, 4);
		expect(buf[5]).toBe(4);
		expect(buf[4]).toBe(2);
		expect(buf[6]).toBe(2);
	});

	it("never writes to the 1px border (matches the 2D ripple's bounds guard)", () => {
		const buf = new Float32Array(10);
		pokeWave1D(buf, 10, 0, 5);
		pokeWave1D(buf, 10, 9, 5);
		expect(buf[0]).toBe(0);
		expect(buf[9]).toBe(0);
	});
});

describe('stepWave1D', () => {
	it('computes each interior cell as (neighbor average * 0.5 - previous) * damping', () => {
		const size = 3;
		const current = new Float32Array(3);
		current[0] = 4; // west of index 1
		current[2] = 2; // east of index 1
		const previous = new Float32Array(3);
		previous[1] = 1;

		const { next, prev } = stepWave1D(size, current, previous);
		const expected = ((4 + 2) * 0.5 - 1) * 0.94;
		expect(next[1]).toBeCloseTo(expected);
		expect(prev).toBe(current); // buffer swap: old "current" becomes the new "previous"
	});

	it('decays a still pond toward zero via the damping factor', () => {
		const size = 3;
		const current = new Float32Array(3); // no wave energy anywhere
		const previous = new Float32Array(3);
		previous[1] = 2;
		const { next } = stepWave1D(size, current, previous);
		expect(next[1]).toBeCloseTo((0 - 2) * 0.94);
	});

	it('decays toward zero over a long run — a damped wave settles, it does not sustain forever', () => {
		const size = 20;
		let buffers: { current: Float32Array; previous: Float32Array } = {
			current: new Float32Array(size),
			previous: new Float32Array(size)
		};
		pokeWave1D(buffers.current, size, 10, 10);
		const initialEnergy = buffers.current.reduce((sum, v) => sum + Math.abs(v), 0);
		for (let i = 0; i < 200; i++) {
			const { next, prev } = stepWave1D(size, buffers.current, buffers.previous);
			buffers = { current: next, previous: prev };
		}
		const finalEnergy = buffers.current.reduce((sum, v) => sum + Math.abs(v), 0);
		expect(finalEnergy).toBeLessThan(initialEnergy * 0.05);
	});

	it('leaves the 1px border untouched across steps', () => {
		const size = 8;
		const current = new Float32Array(size).fill(1);
		const previous = new Float32Array(size).fill(0.5);
		const { next } = stepWave1D(size, current, previous);
		expect(next[0]).toBe(0);
		expect(next[size - 1]).toBe(0);
	});
});
