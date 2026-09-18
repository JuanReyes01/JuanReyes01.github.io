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
import { clamp, clamp01 } from './math';

/** A signature's own raw amplitude (0.5-0.85) rarely reaches the strip's
 * full +-1 row range on its own; this boosts the displayed height so even
 * the calmest signature visibly travels most of the strip, not just its
 * middle third. Shared by the live `WaveformEngine` and the build-time
 * {@link staticWaveformRows} so a case study's zero-JS header reads at the
 * same visual scale as `/work/`'s own live one. */
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
 * poke should actually add — ported verbatim from the owner-approved header
 * prototype's own `WaveHeader.poke()`: "a dent in the line, not a spike
 * that slams it into the frame." Below the cap it scales linearly; above it
 * (a fast drag or a hard pointerdown) it flattens out at 0.55 instead of
 * growing unbounded. */
export function waveformPokeAmount(strength: number): number {
	return Math.min(0.55, strength * 0.06);
}

/**
 * Adds wave energy at `index` and its 2 neighbors (full strength at the
 * center, half strength around it), skipping the buffer's 1px border — the
 * 1D analog of `fields/ripple.ts`'s `pokeRipple`, for the waveform's own
 * pointer-deform interaction.
 */
export function pokeWave1D(
	buffer: Float32Array,
	size: number,
	index: number,
	strength: number
): void {
	for (let d = -1; d <= 1; d++) {
		const i = index + d;
		if (i < 1 || i >= size - 1) continue;
		buffer[i] += strength * (d === 0 ? 1 : 0.5);
	}
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
 * Damping ported verbatim from the owner-approved header prototype: "this
 * scheme decays by sqrt(damping) per step, not by damping, so 0.74 is what
 * gives ~0.86/step — a poke is gone in about a second," faster than the
 * slower 2D ripple's own 0.94.
 */
export function stepWave1D(
	size: number,
	current: Float32Array,
	previous: Float32Array,
	damping = 0.74
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

/** An arbitrary fixed instant for the static build (design: matches the
 * spirit of every other engine's fixed reduced-motion seed — a calm, static
 * pose, not "the start" of anything). */
const STATIC_WAVE_T = 1.2;

/**
 * A `rows`-by-`cols` static ASCII trace of `seedText`'s own
 * {@link deriveWaveSignature}, sampled once at a fixed instant — the
 * zero-JS `/work/[slug]/` counterpart to `WaveformEngine`'s live canvas, so
 * a case study's own build-time header reads as ITS waveform rather than
 * the generic ambient field every other static header uses. Pure and
 * deterministic (design D1): same `cols`/`rows`/`seedText` always produces
 * the exact same rows.
 */
export function staticWaveformRows(cols: number, rows: number, seedText: string): string[] {
	const signature = deriveWaveSignature(seedText);
	const grid: string[][] = Array.from({ length: rows }, () => new Array(cols).fill(' '));

	let prevRow = 0;
	for (let x = 0; x < cols; x++) {
		const xn = cols > 1 ? x / (cols - 1) : 0;
		const height = clamp(sampleWaveform(xn, signature, STATIC_WAVE_T) * DISPLAY_GAIN, -1, 1);
		const row = Math.round(clamp01((1 - height) / 2) * (rows - 1));
		const from = x === 0 ? row : prevRow;
		for (let y = 0; y < rows; y++) {
			const glyph = traceGlyph(row, from, y, rows);
			if (glyph) grid[y][x] = glyph;
		}
		prevRow = row;
	}

	return grid.map((line) => line.join(''));
}
