/**
 * Hummingbird geometry sampling for `/field/`'s band (design D1 boundary,
 * motion table "Sky /"). Ported byte-for-byte from the owner-approved header
 * prototype's own `sampleBird`/`ellipseHit`/`segmentDistance`/`solidness`
 * functions — every magic number here is load-bearing, so this stays a
 * faithful port of the layered ellipse/segment hit-tests, not a
 * reinterpretation. (The flower/stem/leaf geometry below was re-ported from
 * the prototype during the approved-header-prototype apply pass — it used to
 * match an older pre-prototype "legacy" flower that was noticeably smaller
 * and merged the leaf into the stem's own key.)
 */
import { clamp } from './math';

/** Every silhouette part `sampleBird` can classify a cell into. */
export type BirdPartKey =
	| 'body'
	| 'belly'
	| 'tail'
	| 'crown'
	| 'gorget'
	| 'beak'
	| 'farwing'
	| 'ghost'
	| 'wing'
	| 'eye'
	| 'petal'
	| 'fcenter'
	| 'stem'
	| 'leaf';

export interface BirdSample {
	key: BirdPartKey;
	/** Ramp/opacity value in `[0, 1]`. `eye` is always `0` — a hole in the head. */
	value: number;
}

/** Per-frame pose: sway/bob/wingbeat phase plus the current screen scale. */
export interface BirdFrame {
	bx: number;
	by: number;
	ph: number;
	thin: number;
	tailR: number;
	eyeR2: number;
}

/**
 * The wingbeat pose at time `t` (owner rule: 1.1 Hz wingbeat, sway
 * `0.012*sin(t*0.5)`, bob `0.02*sin(t*0.8)`). Under reduced motion the bird
 * parks at the legacy's fixed `ph=0.9` pose with no sway/bob.
 */
export function computeBirdMotion(
	t: number,
	reduced: boolean
): Pick<BirdFrame, 'bx' | 'by' | 'ph'> {
	if (reduced) return { bx: 0, by: 0, ph: 0.9 };
	return {
		bx: 0.012 * Math.sin(t * 0.5),
		by: 0.02 * Math.sin(t * 0.8),
		ph: t * Math.PI * 2 * 1.1
	};
}

/** Derives line-thickness geometry from the current cell size and bird scale (all in CSS px). */
export function birdGeometryScale(
	cellHeightPx: number,
	cellWidthPx: number,
	birdScalePx: number
): Pick<BirdFrame, 'thin' | 'tailR' | 'eyeR2'> {
	const thin = (0.5 * cellHeightPx) / birdScalePx;
	const tailR = Math.max(0.045, thin);
	const eyeR2 = Math.pow(Math.max(0.035, (0.55 * cellWidthPx) / birdScalePx), 2);
	return { thin, tailR, eyeR2 };
}

interface EllipseHit {
	f: number;
	lx: number;
	ly: number;
}

/** Rotated-ellipse hit test: `null` outside, else the fill factor `1 - q` and local coords. */
function ellipseHit(
	x: number,
	y: number,
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	rot: number
): EllipseHit | null {
	const c = Math.cos(rot);
	const s = Math.sin(rot);
	const dx = x - cx;
	const dy = y - cy;
	const lx = (dx * c + dy * s) / rx;
	const ly = (-dx * s + dy * c) / ry;
	const q = lx * lx + ly * ly;
	return q < 1 ? { f: 1 - q, lx, ly } : null;
}

/** Distance from `(px, py)` to the line segment `(ax, ay)-(bx, by)`. */
function segmentDistance(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number
): number {
	const vx = bx - ax;
	const vy = by - ay;
	const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1);
	const dx = px - (ax + vx * t);
	const dy = py - (ay + vy * t);
	return Math.hypot(dx, dy);
}

function solidness(f: number): number {
	return 0.5 + 0.5 * Math.min(1, f * 2.4);
}

/**
 * Classifies a normalized (bird-space) point into a silhouette part, back
 * to front: flower/stem, far wing, tail fan, body/belly, head (crown vs
 * face), gorget, beak, near wing (ghost then the real wing, which only
 * shows over empty or far-wing cells), and finally the eye — a hole cut
 * into the head. Later layers unconditionally win over earlier ones,
 * matching the legacy draw order exactly.
 */
export function sampleBird(x: number, y: number, frame: BirdFrame): BirdSample | null {
	if (x < -1.45 || x > 0.88 || y < -0.9 || y > 0.72) return null;

	const { bx, by, ph, thin, tailR, eyeR2 } = frame;
	let key: BirdPartKey | null = null;
	let value = 0;

	// Flower (static; the bird bobs, the flower does not).
	const fdx = x + 1.14;
	const fdy = y + 0.06;
	const rr = Math.hypot(fdx, fdy);
	if (rr < 0.075) {
		key = 'fcenter';
		value = 0.95;
	} else if (rr < 0.26) {
		const petal = 0.17 + 0.075 * Math.cos(Math.atan2(fdy, fdx) * 5 + 0.4);
		if (rr < petal) {
			key = 'petal';
			value = 0.5 + 0.45 * (1 - rr / petal);
		}
	}
	if (!key && segmentDistance(x, y, -1.15, 0.06, -1.2, 0.58) < Math.max(0.016, thin * 0.8)) {
		key = 'stem';
		value = 0.6;
	}
	if (!key) {
		const leaf = ellipseHit(x, y, -1.07, 0.38, 0.13, Math.max(0.04, thin), -0.5);
		if (leaf) {
			key = 'leaf';
			value = 0.4 + 0.4 * leaf.f;
		}
	}

	// Far wing.
	const farAngle = -1.3 + 0.5 * Math.sin(ph + 0.4);
	const farWing = ellipseHit(
		x,
		y,
		0.02 + bx + Math.cos(farAngle) * 0.33,
		-0.06 + by + Math.sin(farAngle) * 0.33,
		0.36,
		Math.max(0.07, thin),
		farAngle
	);
	if (farWing) {
		key = 'farwing';
		value = 0.35 + 0.3 * farWing.f;
	}

	// Tail fan (3 feathers).
	for (let k = 0; k < 3; k++) {
		const tailAngle = 0.55 + k * 0.3;
		const length = 0.36 - k * 0.03;
		const feather = ellipseHit(
			x,
			y,
			0.38 + bx + (Math.cos(tailAngle) * length) / 2,
			0.27 + by + (Math.sin(tailAngle) * length) / 2,
			length / 2,
			tailR,
			tailAngle
		);
		if (feather) {
			key = 'tail';
			value = 0.55 + 0.4 * feather.f;
		}
	}

	// Body + belly.
	const body = ellipseHit(x, y, 0.1 + bx, 0.07 + by, 0.38, 0.2, 0.5);
	if (body) {
		key = body.ly > 0.3 ? 'belly' : 'body';
		value = solidness(body.f);
	}

	// Head: blue crown on top, green face below.
	const headCenterX = -0.22 + bx;
	const headCenterY = -0.15 + by;
	const head = ellipseHit(x, y, headCenterX, headCenterY, 0.17, 0.17, 0);
	if (head) {
		key = y - headCenterY < -0.04 ? 'crown' : 'body';
		value = solidness(head.f);
	}

	// Gorget.
	if (body || head) {
		const gx = x - (-0.15 + bx);
		const gy = y - (-0.02 + by);
		if (gx * gx + gy * gy < 0.014) {
			key = 'gorget';
			value = 0.8;
		}
	}

	// Beak.
	if (segmentDistance(x, y, -0.37 + bx, -0.17 + by, -1.0 + bx, -0.1 + by) < Math.max(0.02, thin)) {
		key = 'beak';
		value = 0.85;
	}

	// Near wing: ghost first (only over empty/far-wing cells), then the wing itself.
	const ghostAngle = -1.1 + 0.55 * Math.sin(ph - 0.45);
	const ghost = ellipseHit(
		x,
		y,
		0.02 + bx + Math.cos(ghostAngle) * 0.33,
		-0.06 + by + Math.sin(ghostAngle) * 0.33,
		0.36,
		Math.max(0.075, thin),
		ghostAngle
	);
	if (ghost && (!key || key === 'farwing')) {
		key = 'ghost';
		value = 0.35 + 0.2 * ghost.f;
	}
	const wingAngle = -1.1 + 0.55 * Math.sin(ph);
	const wing = ellipseHit(
		x,
		y,
		0.02 + bx + Math.cos(wingAngle) * 0.33,
		-0.06 + by + Math.sin(wingAngle) * 0.33,
		0.36,
		Math.max(0.075, thin),
		wingAngle
	);
	if (wing) {
		key = 'wing';
		value = 0.5 + 0.4 * wing.f;
	}

	// Eye (a hole).
	if (head) {
		const ex = x - (-0.27 + bx);
		const ey = y - (-0.19 + by);
		if (ex * ex + ey * ey < eyeR2) {
			key = 'eye';
			value = 0;
		}
	}

	if (!key) return null;
	return { key, value };
}
