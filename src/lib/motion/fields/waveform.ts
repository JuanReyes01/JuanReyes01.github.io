/**
 * A per-build ASCII waveform for `/work/` (owner decision `site/v2-direction`
 * slice S3, item D): "an ASCII waveform in/next to the work header field.
 * The pointer deforms it (1D damped wave, like the hero ripple), and
 * hovering or focusing a build row changes its signature deterministically
 * (amplitude/frequency/wave count derived from that build's metric or
 * slug — unit-test the mapping)." Pure, DOM-free (design D1 boundary): the
 * signature derivation, the wave shape itself, and the 1D damped-wave
 * simulation are all plain math here; only `engines/waveform.ts` touches a
 * canvas.
 */
/** A signature's own raw amplitude (0.5-0.85) rarely reaches the strip's
 * full +-1 row range on its own; this boosts the displayed height so even
 * the calmest signature visibly travels most of the strip, not just its
 * middle third. */
export const DISPLAY_GAIN = 1.35;

/** The 3 dimensions a build's own waveform signature can vary along. */
export interface WaveSignature {
	/** Peak height, in the same normalized units `sampleWaveform` returns. */
	amplitude: number;
	/** Oscillations per unit of `x` (0-1) for the FIRST harmonic. */
	frequency: number;
	/** Number of harmonic components summed together — more harmonics reads
	 * as a more "complex"/busy waveform, fewer as a cleaner single tone. */
	waveCount: number;
}

/**
 * Deterministic 32-bit FNV-1a hash. Ported from the well-known FNV-1a
 * constants — not a cryptographic hash, just a fast, stable, well-mixed
 * string->integer function so the same seed text always derives the same
 * {@link WaveSignature}.
 */
export function hashString(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/**
 * Maps a build's own seed text (owner: "derived from that build's metric or
 * slug" — callers pass both, e.g. `${slug}:${metric.value}`, so either
 * changing) into a deterministic {@link WaveSignature}. Three independent
 * byte-ranges of the same hash feed the three dimensions, so changing any
 * part of the seed text plausibly changes all three, not just one.
 *
 * Ranges ported verbatim from the owner-approved header prototype: "ranges
 * start well above zero — every build has to read as a wave, not as a flat
 * line that happened to draw a bad hash." Floors: amplitude >= 0.5,
 * frequency >= 1.8, at least 2 harmonics.
 */
export function deriveWaveSignature(seedText: string): WaveSignature {
	const h = hashString(seedText);
	const amplitude = 0.5 + ((h & 0xff) / 255) * 0.35; // 0.5 - 0.85
	const frequency = 1.8 + (((h >>> 8) & 0xff) / 255) * 2.4; // 1.8 - 4.2
	const waveCount = 2 + (((h >>> 16) & 0xff) % 3); // 2 - 4 (integer)
	return { amplitude, frequency, waveCount };
}

/**
 * The waveform's shape at position `x` (0-1 across the strip) and time `t`
 * (seconds), summing `sig.waveCount` harmonics (frequency x1, x2, x3...) at
 * `1/k` weight each — a classic additive-synthesis falloff, so higher
 * harmonics add texture without ever dominating the fundamental. Normalized
 * by the harmonic weights' own sum so the result never exceeds
 * `sig.amplitude` regardless of `waveCount`.
 */
export function sampleWaveform(x: number, sig: WaveSignature, t: number): number {
	let sum = 0;
	let norm = 0;
	for (let k = 1; k <= sig.waveCount; k++) {
		const weight = 1 / k;
		sum += weight * Math.sin(2 * Math.PI * sig.frequency * k * x + t * 0.6 + k * 1.3);
		norm += weight;
	}
	return (sum / norm) * sig.amplitude;
}

/** Caps a raw pointer-speed strength into the small amount of wave energy a
 * poke should actually add — ported from the owner-approved header
 * prototype's own `WaveHeader.poke()`: "a dent in the line, not a spike
 * that slams it into the frame." Below the cap it scales linearly; above it
 * (a fast drag or a hard pointerdown) it flattens out instead of growing
 * unbounded. Medium-intensity tuning: gain 0.18 per unit of pointer force,
 * capped at 2.4 — `softClip` (not this cap alone) is what keeps a hard poke
 * from flattening the strip against the frame. */
export function waveformPokeAmount(strength: number): number {
	return Math.min(2.4, strength * 0.18);
}

/**
 * Adds wave energy at `index` and its 4 neighbors (2 on each side), full
 * strength at the center and tapering by `1 - |d|/3` outward — the 1D analog
 * of `fields/ripple.ts`'s `pokeRipple`, for the waveform's own pointer-deform
 * interaction. Medium-intensity port (owner-approved header prototype v5):
 * "poke radius 2", ported verbatim from the prototype's own
 * `WaveHeader.poke()` falloff.
 */
export function pokeWave1D(
	buffer: Float32Array,
	size: number,
	index: number,
	strength: number
): void {
	for (let d = -2; d <= 2; d++) {
		const i = index + d;
		if (i < 1 || i >= size - 1) continue;
		buffer[i] += strength * (1 - Math.abs(d) / 3);
	}
}

/**
 * Keeps a poked wave inside the strip smoothly instead of a hard clamp:
 * linear for `|v| <= 0.8`, then eases toward +-1 via `tanh` beyond that.
 * Medium-intensity port (owner-approved header prototype v5): "a hard poke
 * never flattens against the frame" — ported verbatim from the prototype's
 * own `softClip()`.
 */
export function softClip(v: number): number {
	const magnitude = Math.abs(v);
	if (magnitude <= 0.8) return v;
	const sign = v < 0 ? -1 : 1;
	return sign * (0.8 + 0.2 * Math.tanh((magnitude - 0.8) / 0.2));
}

/** Below this magnitude a step snaps straight to zero (prototype: "the snap
 * to zero below a threshold is what makes it actually stop instead of
 * ringing on" forever) — an ever-shrinking float never quite reaches 0 on
 * its own, so `isSettled()`-style checks downstream would never see a truly
 * flat wave without this. */
const SETTLE_THRESHOLD = 0.004;

/**
 * Advances the 1D damped-wave simulation by one step — the 1D analog of
 * `fields/ripple.ts`'s `stepRipple` (same discrete wave equation), computed
 * into a fresh buffer rather than mutating `previous` in place.
 *
 * Medium-intensity port (owner-approved header prototype v5): damping is now
 * 0.96 (was 0.74) — combined with the engine calling this 3 times per frame
 * (`WAVE_SUBSTEPS`), this is what lets a pulse actually travel ~45 columns
 * and settle in ~2.7s, instead of dying out almost on the spot.
 */
export function stepWave1D(
	size: number,
	current: Float32Array,
	previous: Float32Array,
	damping = 0.96
): { next: Float32Array; prev: Float32Array } {
	const next = new Float32Array(size);
	for (let i = 1; i < size - 1; i++) {
		const neighborAvg = (current[i - 1] + current[i + 1]) * 0.5;
		const v = (neighborAvg - previous[i]) * damping;
		next[i] = Math.abs(v) < SETTLE_THRESHOLD ? 0 : v;
	}
	return { next, prev: current };
}

/** A jump of this many rows or more between adjacent columns reads as
 * "near-vertical" (coordinator: "with `|` only for near-vertical") instead
 * of a stretched diagonal. */
const NEAR_VERTICAL_ROWS = 3;

/**
 * Chooses the glyph (or `null` to skip) for a single grid cell — column
 * `x`'s row `y` — when tracing a continuous line from `prevRow` (the
 * previous column's row) to `row` (this column's row). Coordinator
 * correction: "the waveform reads as a dashed staircase, not a wave. It
 * needs a continuous stroke... make sure consecutive cells join visually
 * instead of leaving gaps." Filling EVERY row in `[min(row,prevRow),
 * max(row,prevRow)]` at this column — a classic ASCII line-plot technique —
 * is what makes that happen: the previous column's glyph and this one
 * visually touch, instead of a single point-sampled glyph per column
 * leaving a gap whenever the wave moves more than one row between columns.
 *
 * Pure and DOM-free on purpose (design D1) — `engines/waveform.ts` is the
 * only caller, but the actual "does this look like a connected line"
 * decision is plain row arithmetic, easy to unit-test without a canvas.
 */
export function traceGlyph(
	row: number,
	prevRow: number,
	y: number,
	rows: number
): '/' | '\\' | '|' | '-' | '_' | '‾' | null {
	const lo = Math.min(row, prevRow);
	const hi = Math.max(row, prevRow);
	if (y < lo || y > hi) return null;

	if (row === prevRow) {
		// A flat run: pick the glyph by the row's OWN position (not just a
		// plain "-" everywhere) so a crest/trough still reads as the top/
		// bottom of a wave, not a flat line running through it.
		if (row === 0) return '‾';
		if (row === rows - 1) return '_';
		return '-';
	}
	if (hi - lo >= NEAR_VERTICAL_ROWS) return '|';
	// Row 0 is the TOP (height +1), so a decreasing row number means the
	// wave is RISING between these two columns.
	return row < prevRow ? '/' : '\\';
}
