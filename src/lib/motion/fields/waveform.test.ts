import { describe, it, expect } from 'vitest';
import {
	hashString,
	deriveWaveSignature,
	sampleWaveform,
	pokeWave1D,
	stepWave1D,
	traceGlyph,
	staticWaveformRows,
	waveformPokeAmount,
	softClip
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

	// Coordinator correction (approved header prototype port): "ranges start
	// well above zero: every build has to read as a wave, not as a flat line
	// that happened to draw a bad hash" — floors are amplitude >= 0.5,
	// frequency >= 1.8, waveCount >= 2, ported verbatim from the prototype's
	// own tuned `deriveWaveSignature`.
	it('keeps every dimension within the prototype-tuned, always-visible range', () => {
		for (const seed of [
			'creditbay:20 → 600',
			'amd:~90%',
			'credit-brain:10',
			'opinion-corpus:100k+'
		]) {
			const sig = deriveWaveSignature(seed);
			expect(sig.amplitude).toBeGreaterThanOrEqual(0.5);
			expect(sig.amplitude).toBeLessThanOrEqual(0.85);
			expect(sig.frequency).toBeGreaterThanOrEqual(1.8);
			expect(sig.frequency).toBeLessThanOrEqual(4.2);
			expect(Number.isInteger(sig.waveCount)).toBe(true);
			expect(sig.waveCount).toBeGreaterThanOrEqual(2);
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
	// Medium-intensity port (owner-approved header prototype v5): "poke
	// radius 2" — the deform now reaches 2 cells out on either side (5 taps
	// total), tapering as `1 - |d|/3` (matching the prototype's own
	// `WaveHeader.poke()`), not just the immediate neighbor.
	it('adds full-strength energy at the center, tapering by (1 - |d|/3) over a radius of 2', () => {
		const buf = new Float32Array(10);
		pokeWave1D(buf, 10, 5, 3);
		expect(buf[5]).toBeCloseTo(3); // d=0 -> full
		expect(buf[4]).toBeCloseTo(3 * (1 - 1 / 3)); // d=-1 -> 2
		expect(buf[6]).toBeCloseTo(3 * (1 - 1 / 3)); // d=+1 -> 2
		expect(buf[3]).toBeCloseTo(3 * (1 - 2 / 3)); // d=-2 -> 1
		expect(buf[7]).toBeCloseTo(3 * (1 - 2 / 3)); // d=+2 -> 1
	});

	it("never writes to the 1px border cell itself (matches the 2D ripple's bounds guard)", () => {
		const buf = new Float32Array(10);
		pokeWave1D(buf, 10, 0, 5);
		pokeWave1D(buf, 10, 9, 5);
		expect(buf[0]).toBe(0);
		expect(buf[9]).toBe(0);
	});
});

describe('waveformPokeAmount', () => {
	// Medium-intensity port (owner-approved header prototype v5): "gain 0.18
	// per unit of pointer force with a cap of 2.4" — replaces the prior
	// 0.06/0.55 tuning now that `softClip` (not a hard clamp) absorbs a
	// bigger poke without flattening the strip.
	it('scales a moderate strength linearly by 0.18', () => {
		expect(waveformPokeAmount(4)).toBeCloseTo(0.72);
	});

	it('caps at 2.4 regardless of how large the strength gets', () => {
		expect(waveformPokeAmount(20)).toBe(2.4);
		expect(waveformPokeAmount(500)).toBe(2.4);
	});
});

describe('softClip', () => {
	// Medium-intensity port: "linear to 0.8, tanh beyond" — a hard poke never
	// flattens the strip against the frame the way a hard clamp would.
	it('passes values within +-0.8 through unchanged (linear region)', () => {
		expect(softClip(0.5)).toBe(0.5);
		expect(softClip(-0.3)).toBe(-0.3);
		expect(softClip(0.8)).toBe(0.8);
		expect(softClip(-0.8)).toBe(-0.8);
	});

	it('eases values beyond 0.8 toward +-1 instead of clamping hard at the threshold', () => {
		const clipped = softClip(1.5);
		expect(clipped).toBeGreaterThan(0.8);
		expect(clipped).toBeLessThan(1);
	});

	it('never reaches or exceeds 1 in magnitude for a large-but-not-float-saturating value', () => {
		expect(Math.abs(softClip(2))).toBeLessThan(1);
	});

	it('is bounded at 1 even at floating-point saturation for an extreme value', () => {
		expect(Math.abs(softClip(1000))).toBeLessThanOrEqual(1);
	});

	it('is symmetric: softClip(-v) === -softClip(v)', () => {
		expect(softClip(-2)).toBeCloseTo(-softClip(2));
	});
});

describe('stepWave1D', () => {
	// Medium-intensity port (owner-approved header prototype v5): the default
	// damping is now 0.96 (was 0.74) — combined with 3 substeps/frame at the
	// engine level, this is what lets a pulse travel ~45 columns and settle
	// in ~2.7s, instead of dying out almost immediately.
	it('computes each interior cell as (neighbor average * 0.5 - previous) * damping', () => {
		const size = 3;
		const current = new Float32Array(3);
		current[0] = 4; // west of index 1
		current[2] = 2; // east of index 1
		const previous = new Float32Array(3);
		previous[1] = 1;

		const { next, prev } = stepWave1D(size, current, previous);
		const expected = ((4 + 2) * 0.5 - 1) * 0.96;
		expect(next[1]).toBeCloseTo(expected);
		expect(prev).toBe(current); // buffer swap: old "current" becomes the new "previous"
	});

	it('decays a still pond toward zero via the damping factor', () => {
		const size = 3;
		const current = new Float32Array(3); // no wave energy anywhere
		const previous = new Float32Array(3);
		previous[1] = 2;
		const { next } = stepWave1D(size, current, previous);
		expect(next[1]).toBeCloseTo((0 - 2) * 0.96);
	});

	// Prototype: "the snap to zero below a threshold is what makes it
	// actually stop instead of ringing on forever" — anything under 0.004
	// hard-cuts to exactly 0, not just an ever-shrinking float.
	it('hard-cuts any value below the 0.004 threshold to exactly zero, so it actually stops', () => {
		const size = 3;
		const current = new Float32Array(3);
		const previous = new Float32Array(3);
		previous[1] = 0.004; // (0 - 0.004) * 0.96 = -0.00384, under the threshold
		const { next } = stepWave1D(size, current, previous);
		expect(next[1]).toBe(0);
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

describe('staticWaveformRows', () => {
	it('is deterministic — the same seed and size always produce the same rows', () => {
		const a = staticWaveformRows(60, 7, 'creditbay:20 → 600');
		const b = staticWaveformRows(60, 7, 'creditbay:20 → 600');
		expect(a).toEqual(b);
	});

	it('returns exactly `rows` lines, each `cols` characters wide', () => {
		const rows = staticWaveformRows(40, 5, 'amd:~90%');
		expect(rows).toHaveLength(5);
		for (const line of rows) expect(line).toHaveLength(40);
	});

	it('produces a genuinely different trace for a different build (a static header must look like ITS build)', () => {
		const creditbay = staticWaveformRows(60, 7, 'creditbay:20 → 600').join('\n');
		const amd = staticWaveformRows(60, 7, 'amd:~90%').join('\n');
		expect(creditbay).not.toBe(amd);
	});

	it('draws a connected stroke, not a dashed staircase (more glyphs than columns)', () => {
		const rows = staticWaveformRows(60, 7, 'credit-brain:10');
		const totalGlyphs = rows.join('').replaceAll(' ', '').length;
		expect(totalGlyphs).toBeGreaterThan(60);
	});

	it('never renders a flat line — the trace reaches more than one row', () => {
		const rows = staticWaveformRows(60, 7, 'opinion-corpus:100k+');
		const rowsWithGlyphs = rows.filter((line) => line.trim().length > 0);
		expect(rowsWithGlyphs.length).toBeGreaterThan(1);
	});
});

describe('traceGlyph', () => {
	const ROWS = 7;

	it('skips a row outside the [prevRow, row] span (no glyph drawn there)', () => {
		expect(traceGlyph(4, 2, 0, ROWS)).toBeNull();
		expect(traceGlyph(4, 2, 6, ROWS)).toBeNull();
	});

	it('fills EVERY row of a multi-row jump — a continuous stroke, not a dashed staircase', () => {
		// row=4, prevRow=1: the trace must draw something at y=1,2,3,4 (no gaps).
		for (let y = 1; y <= 4; y++) {
			expect(traceGlyph(4, 1, y, ROWS)).not.toBeNull();
		}
	});

	it('uses "/" for a rising column-to-column move (row decreases — row 0 is the top)', () => {
		expect(traceGlyph(2, 3, 2, ROWS)).toBe('/');
		expect(traceGlyph(2, 3, 3, ROWS)).toBe('/');
	});

	it('uses "\\" for a falling column-to-column move (row increases)', () => {
		expect(traceGlyph(3, 2, 2, ROWS)).toBe('\\');
		expect(traceGlyph(3, 2, 3, ROWS)).toBe('\\');
	});

	it('uses "|" once the jump is steep enough to read as near-vertical, not a stretched diagonal', () => {
		// A 4-row jump (well past the near-vertical threshold) at every row in the span.
		expect(traceGlyph(5, 1, 3, ROWS)).toBe('|');
	});

	it('does NOT use "|" for a shallow one-row move (stays a diagonal)', () => {
		expect(traceGlyph(2, 1, 1, ROWS)).not.toBe('|');
	});

	it('uses a contextual flat glyph — "‾" at the very top row, "_" at the very bottom, "-" elsewhere', () => {
		expect(traceGlyph(0, 0, 0, ROWS)).toBe('‾');
		expect(traceGlyph(ROWS - 1, ROWS - 1, ROWS - 1, ROWS)).toBe('_');
		expect(traceGlyph(3, 3, 3, ROWS)).toBe('-');
	});
});
