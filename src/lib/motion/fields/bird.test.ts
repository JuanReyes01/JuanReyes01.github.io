import { describe, it, expect } from 'vitest';
import { birdGeometryScale, computeBirdMotion, sampleBird, type BirdFrame } from './bird';

/**
 * Fixed geometry constants matching the legacy `Sky` constructor's initial
 * `F` object (`thin: 0.05, tailR: 0.05, eyeR2: 0.002`) — every fixture below
 * was cross-checked against a verbatim extraction of the legacy
 * `sampleBird`/`ell`/`segDist` functions run standalone, so these are
 * ground-truth values, not hand-derived approximations.
 */
const GEOMETRY = { thin: 0.05, tailR: 0.05, eyeR2: 0.002 };

function frameAt(t: number): BirdFrame {
	return { ...computeBirdMotion(t, false), ...GEOMETRY };
}

describe('computeBirdMotion', () => {
	it('computes sway (bx), bob (by) and the 1.1 Hz wingbeat phase from time', () => {
		const t = 2.5;
		const m = computeBirdMotion(t, false);
		expect(m.bx).toBeCloseTo(0.012 * Math.sin(t * 0.5));
		expect(m.by).toBeCloseTo(0.02 * Math.sin(t * 0.8));
		expect(m.ph).toBeCloseTo(t * Math.PI * 2 * 1.1);
	});

	it('parks at a fixed pose under reduced motion, matching the legacy `F.ph = 0.9` fallback', () => {
		expect(computeBirdMotion(1000, true)).toEqual({ bx: 0, by: 0, ph: 0.9 });
	});
});

describe('birdGeometryScale', () => {
	it('derives thin/tailR/eyeR2 from cell size and the bird scale in px', () => {
		const g = birdGeometryScale(14, 7, 150);
		expect(g.thin).toBeCloseTo(0.5 * (14 / 150));
		expect(g.tailR).toBeCloseTo(Math.max(0.045, 0.5 * (14 / 150)));
		expect(g.eyeR2).toBeCloseTo(Math.pow(Math.max(0.035, 0.55 * (7 / 150)), 2));
	});

	it('floors thin/eyeR2 at the legacy minimums for a very large bird scale', () => {
		const g = birdGeometryScale(2, 1, 10000);
		expect(g.tailR).toBeCloseTo(0.045);
		expect(g.eyeR2).toBeCloseTo(0.035 * 0.035);
	});
});

describe('sampleBird', () => {
	it('returns null outside the bird/flower bounding box', () => {
		expect(sampleBird(-5, -5, frameAt(0))).toBeNull();
	});

	it('classifies the flower center', () => {
		expect(sampleBird(-1.14, -0.06, frameAt(0))).toEqual({ key: 'fcenter', value: 0.95 });
	});

	it('classifies a flower petal', () => {
		const s = sampleBird(-1.04032, -0.06799, frameAt(0));
		expect(s?.key).toBe('petal');
		expect(s?.value).toBeCloseTo(0.6688, 3);
	});

	it('classifies the flower stem (both the straight segment and the leaf ellipse)', () => {
		expect(sampleBird(-1.07, 0.54, frameAt(0))).toEqual({ key: 'stem', value: 0.8 });
	});

	it('classifies the body center', () => {
		expect(sampleBird(0.1, 0.07, frameAt(0))).toEqual({ key: 'body', value: 1 });
	});

	it('classifies the belly (body ellipse, local y beyond 0.3)', () => {
		const s = sampleBird(0.06644, 0.13143, frameAt(0));
		expect(s?.key).toBe('belly');
		expect(s?.value).toBeCloseTo(1, 3);
	});

	it('classifies the crown (top of the head ellipse)', () => {
		const s = sampleBird(-0.22, -0.3, frameAt(0));
		expect(s?.key).toBe('crown');
		expect(s?.value).toBeCloseTo(0.7657, 3);
	});

	it('classifies the gorget (a small disc in front of the head/body)', () => {
		expect(sampleBird(-0.15, -0.02, frameAt(0))).toEqual({ key: 'gorget', value: 0.8 });
	});

	it('classifies the beak', () => {
		expect(sampleBird(-0.685, -0.135, frameAt(0))).toEqual({ key: 'beak', value: 0.85 });
	});

	it('cuts a hole for the eye (value 0, caller skips drawing it)', () => {
		expect(sampleBird(-0.27, -0.19, frameAt(0))).toEqual({ key: 'eye', value: 0 });
	});

	it('classifies the tail fan', () => {
		const s = sampleBird(0.4889, 0.394, frameAt(0));
		expect(s?.key).toBe('tail');
		expect(s?.value).toBeCloseTo(0.5685, 3);
	});

	it('classifies the near wing at its swing center', () => {
		const s = sampleBird(0.16969, -0.3541, frameAt(0));
		expect(s?.key).toBe('wing');
		expect(s?.value).toBeCloseTo(0.9, 3);
	});

	it('classifies the ghost wing where it does not overlap the near wing', () => {
		const s = sampleBird(0.09574, -0.38119, frameAt(0));
		expect(s?.key).toBe('ghost');
		expect(s?.value).toBeCloseTo(0.55, 3);
	});

	it('classifies the far wing once mid-wingbeat separates it from the near wing (ph=PI)', () => {
		const tHalf = Math.PI / (2 * Math.PI * 1.1);
		const s = sampleBird(0.04778839623715914, -0.3819317304746857, frameAt(tHalf));
		expect(s?.key).toBe('farwing');
		expect(s?.value).toBeCloseTo(0.65, 3);
	});
});
