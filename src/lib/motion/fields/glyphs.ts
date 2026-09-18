/**
 * Directional-glyph ASCII rendering (owner decision `site/v2-direction` item
 * 6: "the theme is ASCII ART, but super advanced" — upgrade from a flat
 * brightness -> density ramp to glyphs chosen by the LOCAL GRADIENT
 * DIRECTION, so shapes read as drawn rather than as a blob of symbols).
 * Pure/DOM-free (design D1 boundary): every function samples a
 * caller-provided scalar field and returns a glyph, a gradient, or a
 * corner-response number — never a canvas, never a color. Callers
 * (`engines/sky.ts` today) plug this into their own per-cell draw loop by
 * passing in whatever scalar field they already sample (noise, dither
 * value, a shape mask...).
 *
 * The technique: at each cell, take the local gradient of the sampled
 * field. Where the gradient is WEAK (a flat interior), fall back to the
 * classic brightness -> density ramp. Where it's STRONG (a real edge), pick
 * one of four line glyphs from the gradient's direction — the edge a
 * gradient crosses runs PERPENDICULAR to the gradient vector itself, so a
 * horizontal gradient (brightness changes left/right) traces a VERTICAL
 * edge (`|`), and so on. A small Harris-style corner response (the
 * structure-tensor determinant minus a multiple of its trace, evaluated
 * over the 3x3 neighborhood) picks out real junctions — where two edges
 * actually meet, not just where one edge happens to run diagonally (which
 * `/`/`\` already cover on their own) — as `+`.
 */

/** The classic brightness -> character ramp, dimmest to brightest. */
export const DENSITY_RAMP = ' .·:-=+*#%@';

export interface Gradient {
	gx: number;
	gy: number;
	magnitude: number;
}

/**
 * Central-difference gradient of `sample` at `(x, y)`, step `h` (default one
 * grid cell). `sample` is any scalar field — a noise texture, a dither
 * value, a shape mask returning 0/1, whatever the caller already computes
 * per cell. Central differences are exact for a linear field and a good
 * local approximation everywhere else, matching a simple Sobel-lite
 * gradient without needing the full 3x3 kernel.
 */
export function sampleGradient(
	sample: (x: number, y: number) => number,
	x: number,
	y: number,
	h = 1
): Gradient {
	const gx = (sample(x + h, y) - sample(x - h, y)) / (2 * h);
	const gy = (sample(x, y + h) - sample(x, y - h)) / (2 * h);
	return { gx, gy, magnitude: Math.hypot(gx, gy) };
}

export type EdgeGlyph = '-' | '|' | '/' | '\\';

/** Bucket half-width: each of the 4 edge buckets spans 45 degrees, centered
 * on 0/45/90/135. */
const EIGHTH_PI = Math.PI / 8;

/**
 * Buckets the gradient's direction into one of 4 edge-tangent glyphs, or
 * `null` below `threshold` (the caller should fall back to a density
 * glyph — this is what keeps flat interiors calm instead of noisy).
 *
 * The edge tangent is the gradient rotated 90 degrees, and is undirected
 * (mod PI): a line and its exact reverse read as the same glyph, so
 * opposite gradients (e.g. `(2, 0)` and `(-2, 0)`) bucket identically.
 */
export function directionalGlyph(
	gx: number,
	gy: number,
	magnitude: number,
	threshold: number
): EdgeGlyph | null {
	if (magnitude < threshold) return null;
	// Tangent = gradient rotated +90 degrees: (tx, ty) = (-gy, gx).
	let angle = Math.atan2(gx, -gy);
	if (angle < 0) angle += Math.PI;
	if (angle >= Math.PI) angle -= Math.PI;

	if (angle < EIGHTH_PI || angle >= 7 * EIGHTH_PI) return '-';
	if (angle < 3 * EIGHTH_PI) return '\\';
	if (angle < 5 * EIGHTH_PI) return '|';
	return '/';
}

/**
 * A Harris-style corner/junction response: the local gradient structure
 * tensor (`Ixx`, `Iyy`, `Ixy`), averaged over the 3x3 neighborhood centered
 * at `(x, y)`, reduced to `det(M) - k * trace(M)^2`. High and positive means
 * two edges genuinely meet here (a corner); near zero or negative means a
 * flat area or a single straight edge (a diagonal edge alone does NOT
 * trigger this — its gradient direction is uniform across the
 * neighborhood, so the tensor stays rank-1 and the determinant stays small).
 */
export function cornerResponse(
	sample: (x: number, y: number) => number,
	x: number,
	y: number,
	h = 1
): number {
	let ixx = 0;
	let iyy = 0;
	let ixy = 0;
	let count = 0;
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			const { gx, gy } = sampleGradient(sample, x + dx * h, y + dy * h, h);
			ixx += gx * gx;
			iyy += gy * gy;
			ixy += gx * gy;
			count++;
		}
	}
	ixx /= count;
	iyy /= count;
	ixy /= count;
	const det = ixx * iyy - ixy * ixy;
	const trace = ixx + iyy;
	const HARRIS_K = 0.04;
	return det - HARRIS_K * trace * trace;
}

export interface PickGlyphOptions {
	/** Minimum gradient magnitude to treat a cell as an edge instead of density. */
	edgeThreshold: number;
	/** Minimum corner response to treat a cell as a junction (`+`) instead of
	 * a plain directional edge. Omit to skip corner detection entirely. */
	cornerThreshold?: number;
	/** Overrides {@link DENSITY_RAMP} for the flat-area fallback. */
	ramp?: string;
	/** How many times a cell's own gradient magnitude must exceed its local
	 * neighborhood average to count as a real edge (see {@link isCoherentEdge}). */
	coherenceFactor?: number;
	/** Max angular difference (radians) between this cell's gradient
	 * direction and a neighbor's for that neighbor to count as "agreeing"
	 * on the edge's direction (see {@link isCoherentEdge}). */
	maxAngleDrift?: number;
}

function clamp01(v: number): number {
	return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Looks up `value` (0-1, clamped) in `ramp`, dimmest to brightest — the
 * plain brightness -> character mapping, with no gradient/edge logic at
 * all. Owner correction (site/v2-direction slice S3, apply-fix round 1):
 * "ambient fields use the density ramp only" — callers that sample a
 * procedural noise field (clouds, iridescence) with no real, coherent
 * shape to trace should call this directly instead of {@link pickGlyph},
 * which is now reserved for fields with an actual silhouette (the
 * hummingbird, a waveform's stroke). */
export function densityGlyph(value: number, ramp: string = DENSITY_RAMP): string {
	const idx = Math.round(clamp01(value) * (ramp.length - 1));
	return ramp.charAt(idx);
}

/** Default: a cell's own gradient magnitude must beat its neighborhood
 * average by 60% to count as a real, localized edge rather than a
 * uniformly-strong (or uniformly-noisy) region. Tuned against the existing
 * step-function/circle-rim fixtures (real edges comfortably clear it) and a
 * spatially uncorrelated noise field (almost never clears it) — see
 * `glyphs.test.ts`. */
const DEFAULT_COHERENCE_FACTOR = 1.12;
/** Default: neighbors within ~22 degrees of this cell's own gradient
 * direction count as "agreeing" on the edge's orientation. */
const DEFAULT_MAX_ANGLE_DRIFT = (22 * Math.PI) / 180;

/** Reduces an undirected angle difference to `[0, PI/2]` — an edge and its
 * exact reverse (`angle` vs `angle + PI`) are the same edge, so they must
 * compare as identical, not maximally different. */
function undirectedAngleDiff(a: number, b: number): number {
	let d = Math.abs(a - b) % (2 * Math.PI);
	if (d > Math.PI) d = 2 * Math.PI - d;
	if (d > Math.PI / 2) d = Math.PI - d;
	return d;
}

/**
 * Owner decision (site/v2-direction slice S3, apply-fix round 1):
 * "directional glyphs belong to shapes, not to noise... only use a
 * directional glyph when the gradient magnitude is well above the local
 * average AND the direction is stable across neighbouring cells." A
 * spatially uncorrelated noise field has plenty of individual cells that
 * cross a plain magnitude threshold, but none of them are a real,
 * localized peak relative to their own neighbors, and neighboring cells'
 * gradient directions have no relationship to each other — this is what
 * distinguishes a genuine edge (a step function, a circle's rim, the
 * hummingbird's silhouette) from noise.
 *
 * Checks two independent conditions against the 4-neighborhood
 * (`x`±1, `y`±1`):
 * 1. This cell's own magnitude exceeds the neighborhood average by
 *    `coherenceFactor` (default 1.35x) — a real edge is a local peak;
 *    uniform noise (or a uniform gradient ramp, which has NO local peak at
 *    all — its magnitude is identical everywhere) is not.
 * 2. At least half of the neighbors whose own magnitude also clears
 *    `edgeThreshold` share a gradient direction within `maxAngleDrift` of
 *    this cell's — a real edge runs continuously through its neighborhood;
 *    noise doesn't.
 */
export function isCoherentEdge(
	sample: (x: number, y: number) => number,
	x: number,
	y: number,
	opts: Pick<PickGlyphOptions, 'edgeThreshold' | 'coherenceFactor' | 'maxAngleDrift'>
): boolean {
	const factor = opts.coherenceFactor ?? DEFAULT_COHERENCE_FACTOR;
	const maxDrift = opts.maxAngleDrift ?? DEFAULT_MAX_ANGLE_DRIFT;

	const center = sampleGradient(sample, x, y);
	if (center.magnitude < opts.edgeThreshold) return false;

	const centerAngle = Math.atan2(center.gy, center.gx);
	const neighborOffsets: Array<[number, number]> = [
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1]
	];

	let magnitudeSum = 0;
	let candidateCount = 0;
	let agreeingCount = 0;
	for (const [dx, dy] of neighborOffsets) {
		const neighbor = sampleGradient(sample, x + dx, y + dy);
		magnitudeSum += neighbor.magnitude;
		if (neighbor.magnitude >= opts.edgeThreshold) {
			candidateCount++;
			const angle = Math.atan2(neighbor.gy, neighbor.gx);
			if (undirectedAngleDiff(centerAngle, angle) <= maxDrift) agreeingCount++;
		}
	}

	const localAverage = magnitudeSum / neighborOffsets.length;
	const isLocalPeak = center.magnitude >= localAverage * factor;
	const directionIsStable = candidateCount > 0 && agreeingCount >= Math.ceil(candidateCount / 2);
	return isLocalPeak && directionIsStable;
}

/**
 * The full per-cell decision: corner glyph, then directional edge glyph —
 * gated by {@link isCoherentEdge} so a directional glyph only appears at a
 * real, localized, directionally-consistent edge — then density-ramp
 * fallback. `value` is the already-sampled field value at `(x, y)` (0-1),
 * reused for the ramp lookup so callers don't re-sample it.
 *
 * Reserved for fields with an actual shape to trace (the hummingbird's
 * silhouette, a waveform's stroke) — a procedural noise field (clouds,
 * iridescence) should call {@link densityGlyph} directly instead (owner
 * rule: "ambient fields use the density ramp only").
 */
export function pickGlyph(
	sample: (x: number, y: number) => number,
	x: number,
	y: number,
	value: number,
	opts: PickGlyphOptions
): string {
	const ramp = opts.ramp ?? DENSITY_RAMP;
	const { gx, gy, magnitude } = sampleGradient(sample, x, y);

	if (magnitude >= opts.edgeThreshold) {
		// Corner detection runs BEFORE the coherence gate below: a corner is
		// exactly the place where direction is UNSTABLE (two straight edges
		// meeting at an angle), which `cornerResponse`'s structure-tensor
		// math already detects on its own — gating it on "direction is
		// stable across neighbors" would reject every real corner outright.
		if (opts.cornerThreshold !== undefined) {
			const corner = cornerResponse(sample, x, y);
			if (corner >= opts.cornerThreshold) return '+';
		}
		if (isCoherentEdge(sample, x, y, opts)) {
			const edge = directionalGlyph(gx, gy, magnitude, opts.edgeThreshold);
			if (edge) return edge;
		}
	}

	return densityGlyph(value, ramp);
}
