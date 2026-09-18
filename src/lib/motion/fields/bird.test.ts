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
	// Medium-intensity port (owner-approved header prototype v5): sway raised
	// 0.012 -> 0.04 and bob raised 0.02 -> 0.055 so the hover reads at real
	// scale now that the bird is large — the 1.1 Hz wingbeat itself is
	// unchanged (it stays in place, it does not follow the pointer).
	it('computes sway (bx), bob (by) and the 1.1 Hz wingbeat phase from time', () => {
		const t = 2.5;
		const m = computeBirdMotion(t, false);
		expect(m.bx).toBeCloseTo(0.04 * Math.sin(t * 0.5));
		expect(m.by).toBeCloseTo(0.055 * Math.sin(t * 0.8));
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

	// Approved header prototype port: the prototype's own bounding box caps
	// at y=0.72 (not 1.02) — the flower's stem is shorter in the prototype,
	// so nothing legitimately reaches that far down anymore.
	it('returns null below the prototype-tuned bounding box (y > 0.72)', () => {
		expect(sampleBird(-1.19, 0.8, frameAt(0))).toBeNull();
	});

	it('classifies the flower center', () => {
		expect(sampleBird(-1.14, -0.06, frameAt(0))).toEqual({ key: 'fcenter', value: 0.95 });
	});

	// Approved header prototype port: petal geometry is ported verbatim from
	// the prototype's own `sampleBird` — the fcenter/petal radii and the
	// petal formula's own coefficients (0.17 + 0.075*cos(...)) are roughly
	// 1.5x the prior "legacy" port's, since the prototype's flower is meant
	// to read clearly next to a bird this large.
	it('classifies a flower petal', () => {
		const s = sampleBird(-1.14, 0.06, frameAt(0));
		expect(s?.key).toBe('petal');
		expect(s?.value).toBeGreaterThan(0);
		expect(s?.value).toBeLessThan(1);
	});

	// Approved header prototype port: the stem is a short segment from the
	// flower down to (-1.20, 0.58) — shorter than the prior "legacy" port's
	// segment down to (-1.22, 1.0).
	it('classifies the flower stem (the straight segment down to the leaf)', () => {
		expect(sampleBird(-1.15, 0.06, frameAt(0))).toEqual({ key: 'stem', value: 0.6 });
	});

	// Approved header prototype port: the prototype's leaf is its OWN key
	// (`leaf`), distinct from `stem` — the prior "legacy" port merged both
	// into a single `stem` key/color.
	it('classifies the leaf ellipse as its own `leaf` key, distinct from the stem', () => {
		expect(sampleBird(-1.07, 0.38, frameAt(0))).toEqual({ key: 'leaf', value: 0.8 });
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

	// The sample point is computed from `computeBirdMotion`'s own bx/by/ph
	// rather than a hardcoded literal, so retuning sway/bob amplitude (this
	// batch: 0.012/0.02 -> 0.04/0.055) doesn't require re-deriving magic
	// numbers by hand — the assertion still exercises `sampleBird`'s own
	// ellipse hit-test (a point placed exactly at the far-wing ellipse's
	// center must classify as `farwing` with fill factor 1, i.e. value 0.65).
	it('classifies the far wing once mid-wingbeat separates it from the near wing (ph=PI)', () => {
		const tHalf = Math.PI / (2 * Math.PI * 1.1);
		const frame = frameAt(tHalf);
		const farAngle = -1.3 + 0.5 * Math.sin(frame.ph + 0.4);
		const x = 0.02 + frame.bx + Math.cos(farAngle) * 0.33;
		const y = -0.06 + frame.by + Math.sin(farAngle) * 0.33;
		const s = sampleBird(x, y, frame);
		expect(s?.key).toBe('farwing');
		expect(s?.value).toBeCloseTo(0.65, 3);
	});
});
