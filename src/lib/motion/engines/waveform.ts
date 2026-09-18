/**
 * The per-build ASCII waveform strip on `/work/` (owner decision
 * `site/v2-direction` slice S3, item D): "an ASCII waveform in/next to the
 * work header field. The pointer deforms it (1D damped wave, like the hero
 * ripple), and hovering or focusing a build row changes its signature
 * deterministically." Owner-approved header prototype port ("rounder, and
 * off the earth tones" pass, `perbuild` study): three composited layers,
 * highest-alpha glyph wins per cell —
 *
 * 1. An ambient field behind everything (the same cloud-noise field
 *    `engines/sky.ts` draws, mixed between the build's own two palette
 *    tokens instead of the hero's fixed hues).
 * 2. A body band: the trace mirrored about the strip's centre line, filled,
 *    deliberately slimmer than the trace itself.
 * 3. The trace: an oscilloscope-style stroke through `curveGlyph`'s
 *    sub-cell ramp (see `fields/waveform.ts`), always the brightest thing
 *    in the frame, turning the `pink` token where the pointer-deform ripple
 *    is currently strong.
 *
 * A build's own color pair (`deriveBuildPalette`) and its own wave shape
 * (`deriveWaveSignature`) both come from the same seed text callers already
 * pass (`${slug}:${metric.value}`) — this engine just holds whichever
 * signature/palette was last set and re-derives nothing itself.
 *
 * Owner rule: "It must stay subtle: animate on interaction (and at most a
 * slow ambient drift), never competing with the timeline." This engine
 * never fully settles while visible (same as every other ambient field
 * here), but its own time multipliers are deliberately slow so the idle
 * drift stays calm; reduced motion still renders one static frame like
 * every other engine.
 */
import {
	deriveWaveSignature,
	deriveBuildPalette,
	sampleWaveform,
	pokeWave1D,
	stepWave1D,
	softClip,
	curveGlyph,
	waveformPokeAmount,
	DISPLAY_GAIN,
	type WaveSignature,
	type PaletteTokenPair
} from '../fields/waveform';
import { mix, hotTraceRgb, type Rgb } from '../fields/color';
import { cloudField } from '../fields/clouds';
import { makeTexture, sampleTexture } from '../fields/noise';
import { ditherOffset4x4 } from '../fields/dither';
import { densityGlyph } from '../fields/glyphs';
import { clamp01 } from '../fields/math';
import { hexToRgb, type Tokens } from '../runtime/tokens';
import { layoutCharGrid, devicePixelRatioCapped, MONO_FONT_NAME } from '../runtime/char-grid';
import type { Engine } from '../runtime/canvas-action';
import type { Section } from '../../site';

/** A sane floor so a not-yet-laid-out or degenerate-height canvas still gets
 * a few rows of vertical travel — the real row count now tracks the actual
 * canvas height (approved header prototype port: the waveform fills the
 * WHOLE header banner, not a fixed strip below it), so this is a minimum,
 * not the row count itself. */
const MIN_ROWS = 5;
const FONT_PX = 11;
const REDUCED_SEED_T = 3;
/** Medium-intensity port (owner-approved header prototype v5): the resting
 * wave travels at this many rad/s — ported verbatim from the prototype's own
 * `WAVE_AMBIENT` (its intensity control itself is not shipped, so "medium",
 * multiplier 1, is hard-coded as this single constant), replacing the
 * earlier, much slower 0.12 tuning. */
const AMBIENT_DRIFT_SPEED = 0.85;
/** Medium-intensity port: three 1D damped-wave substeps per frame — a single
 * step per frame dies out before it goes anywhere; three substeps (at
 * damping 0.96, see `fields/waveform.ts`) let a poke actually travel ~45
 * columns and settle in ~2.7s. Ported verbatim from the prototype's own
 * `WAVE_SUBSTEPS`. */
const WAVE_SUBSTEPS = 3;
/** The ambient field's own fixed reduced-motion pose — ported verbatim from
 * `engines/sky.ts`'s own `REDUCED_SEED_T` (same field math, same rest
 * frame). Kept as a separate constant from the wave's own `REDUCED_SEED_T`
 * because the prototype itself keeps the wave's and the field's seed clocks
 * independent (`WAVE_SEED_T` vs `FIELD_SEED_T`). */
const FIELD_REDUCED_SEED_T = 11.3;
/** The ambient field's own drift speed — ported verbatim from
 * `engines/sky.ts`'s own `FIELD_DRIFT`, so the waveform's background cloud
 * layer drifts at the same rate the hero's does. */
const FIELD_DRIFT = 2.2;
/** The dither term's own weight when it perturbs the ambient field's value —
 * ported verbatim from `engines/sky.ts`'s own dither mix. */
const FIELD_DITHER_WEIGHT = 0.09;
/** The body band runs between `rowFor(height * BODY_SPAN)` and
 * `rowFor(-height * BODY_SPAN)` — deliberately slimmer than the trace's own
 * full-amplitude travel. Ported verbatim from the prototype's own
 * `BODY_SPAN`. */
const BODY_SPAN = 0.55;
/** The default, calm signature shown before any build has been hovered/focused. */
const DEFAULT_SIGNATURE: WaveSignature = deriveWaveSignature('default');
/** The default palette shown before any build has been hovered/focused —
 * same "default" seed the signature falls back to, so the resting strip's
 * shape and color both come from one sentinel seed. */
const DEFAULT_PALETTE: PaletteTokenPair = deriveBuildPalette('default');

/** One grid cell's paint, tracked while compositing the 3 layers — the
 * highest-alpha write for a cell wins (ported verbatim from the prototype's
 * own `put()`), so a brighter trace glyph always shows over a dimmer field/
 * body glyph underneath it. */
interface Cell {
	glyph: string;
	alpha: number;
	rgb: Rgb;
}

/** Formats a raw (already-mixed) RGB triple as a canvas `fillStyle` string —
 * ported verbatim from the prototype's own `rgba()`, including rounding
 * alpha to 2 decimals. */
function cssRgba(rgb: Rgb, alpha: number): string {
	return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.round(alpha * 100) / 100})`;
}

export interface WaveformEngineOptions {
	canvas: HTMLCanvasElement;
	tokens: Tokens;
	reduced: boolean;
	section: Section;
}

export class WaveformEngine implements Engine {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private tokens: Tokens;
	private reduced: boolean;
	private readonly section: Section;

	private readonly textureA = makeTexture(1337);
	private readonly textureB = makeTexture(7331);

	private width = 0;
	private height = 0;
	private cw = 7;
	private ch = 14;
	private cols = 0;
	private rows = MIN_ROWS;

	private signature: WaveSignature = DEFAULT_SIGNATURE;
	private pair: PaletteTokenPair = DEFAULT_PALETTE;
	private ripple: { current: Float32Array; previous: Float32Array } | null = null;

	constructor(opts: WaveformEngineOptions) {
		this.canvas = opts.canvas;
		this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
		this.tokens = opts.tokens;
		this.reduced = opts.reduced;
		this.section = opts.section;
	}

	setTheme(tokens: Tokens): void {
		this.tokens = tokens;
	}

	setReduced(reduced: boolean): void {
		this.reduced = reduced;
		if (reduced) this.ripple = null;
		else if (this.cols) this.ripple = this.freshRippleBuffer();
	}

	setVisibility(): void {}

	isSettled(): boolean {
		return this.reduced;
	}

	destroy(): void {}

	/** Hovering/focusing a build row calls this (owner rule: "changes its
	 * signature deterministically"). */
	setSignature(signature: WaveSignature): void {
		this.signature = signature;
	}

	/** Leaving/blurring a build row returns the strip to its calm default. */
	resetSignature(): void {
		this.signature = DEFAULT_SIGNATURE;
	}

	/** Hovering/focusing a build row also calls this, with the SAME seed
	 * `setSignature` was given (via `deriveBuildPalette`) — the strip's shape
	 * and its color both change together, from the same build. */
	setPalette(pair: PaletteTokenPair): void {
		this.pair = pair;
	}

	/** Leaving/blurring a build row returns the strip to its default pair. */
	resetPalette(): void {
		this.pair = DEFAULT_PALETTE;
	}

	private freshRippleBuffer() {
		return { current: new Float32Array(this.cols), previous: new Float32Array(this.cols) };
	}

	resize(): void {
		const rect = this.canvas.getBoundingClientRect();
		if (!rect.width) return;
		const layout = layoutCharGrid({
			canvas: this.canvas,
			ctx: this.ctx,
			dpr: devicePixelRatioCapped(),
			fontPx: FONT_PX,
			fontFamily: MONO_FONT_NAME,
			minRows: MIN_ROWS
		});
		if (!layout) return;
		this.width = layout.width;
		this.height = layout.height;
		this.cw = layout.cw;
		this.ch = layout.ch;
		this.rows = layout.rows;
		if (layout.cols !== this.cols) {
			this.cols = layout.cols;
			this.ripple = this.reduced ? null : this.freshRippleBuffer();
		}
	}

	/** Adds ripple energy at a pointer/touch X position, in canvas-local client
	 * coordinates. `strength` is a raw pointer-speed value (see
	 * `actions/waveform.ts`) — softened through `waveformPokeAmount` before it
	 * reaches the buffer, so even an extreme drag stays "a dent in the line,
	 * not a spike that slams it into the frame" (owner-approved prototype). */
	poke(clientX: number, strength: number): void {
		if (this.reduced || !this.ripple || !this.cols) return;
		const rect = this.canvas.getBoundingClientRect();
		const cellX = Math.floor((clientX - rect.left) / this.cw);
		pokeWave1D(this.ripple.current, this.cols, cellX, waveformPokeAmount(strength));
	}

	private heightAt(col: number, t: number): number {
		const xn = this.cols > 1 ? col / (this.cols - 1) : 0;
		const base = sampleWaveform(xn, this.signature, t);
		const displaced = this.ripple ? base + this.ripple.current[col] * 0.5 : base;
		// Medium-intensity port: `softClip` (linear to 0.8, tanh beyond)
		// replaces the old hard `clamp(...,-1,1)` — a hard poke dents the
		// line instead of flattening it against the frame.
		return softClip(displaced * DISPLAY_GAIN);
	}

	/** The strip's own float row for a given normalized height (`-1` to `1`,
	 * `+1` at the top) — kept as a float so `curveGlyph` can pick a sub-cell
	 * glyph instead of snapping to a whole row. */
	private rowFloat(height: number): number {
		return clamp01((1 - height) / 2) * (this.rows - 1);
	}

	/** The rounded form of {@link rowFloat} — still used anywhere a single,
	 * discrete row is genuinely what's needed (the body band's own span). */
	private rowFor(height: number): number {
		return Math.round(this.rowFloat(height));
	}

	draw(now: number): void {
		if (!this.cols) return;
		const t = this.reduced ? REDUCED_SEED_T : REDUCED_SEED_T + (now / 1000) * AMBIENT_DRIFT_SPEED;
		const ft = this.reduced
			? FIELD_REDUCED_SEED_T
			: FIELD_REDUCED_SEED_T + (now / 1000) * FIELD_DRIFT;
		if (!this.reduced && this.ripple) {
			for (let sub = 0; sub < WAVE_SUBSTEPS; sub++) {
				const { next, prev } = stepWave1D(this.cols, this.ripple.current, this.ripple.previous);
				this.ripple = { current: next, previous: prev };
			}
		}

		const pairRgb: [Rgb, Rgb] = [
			hexToRgb(this.tokens[this.pair[0]]),
			hexToRgb(this.tokens[this.pair[1]])
		];
		// The poke pulls the trace toward the page's foreground instead of
		// swapping to a flat `pink`: a build whose pair starts at pink was
		// already drawing its resting trace in that exact colour, so the poke
		// changed nothing visible (see `hotTraceRgb`).
		const hotRgb = hotTraceRgb(pairRgb[0], hexToRgb(this.tokens.fg));

		const cells: Array<Cell | null> = new Array(this.cols * this.rows).fill(null);
		const put = (x: number, y: number, glyph: string, alpha: number, rgb: Rgb): void => {
			if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
			const i = y * this.cols + x;
			const existing = cells[i];
			if (!existing || existing.alpha < alpha) cells[i] = { glyph, alpha, rgb };
		};

		// 1. The ambient field, behind everything — the same cloud-noise
		// field `engines/sky.ts` draws, mixed between this build's own pair
		// instead of the hero's fixed hues.
		const unitX = this.cw / 3;
		const unitY = this.ch / 3;
		const heightUnits = this.height / 3;
		for (let y = 0; y < this.rows; y++) {
			for (let x = 0; x < this.cols; x++) {
				const X = x * unitX;
				const Y = y * unitY;
				let v = cloudField(
					(px, py) => sampleTexture(this.textureA, px, py),
					(px, py) => sampleTexture(this.textureB, px, py),
					X,
					Y,
					ft,
					heightUnits
				);
				v = clamp01(v + ditherOffset4x4(x, y) * FIELD_DITHER_WEIGHT);
				const glyph = densityGlyph(v * 0.78);
				if (glyph === ' ') continue;
				const rgb = mix(pairRgb[1], pairRgb[0], clamp01(v * 1.2));
				put(x, y, glyph, 0.07 + v * 0.2, rgb);
			}
		}

		// 2. The body band: the trace mirrored about the centre line,
		// filled, deliberately slimmer than the trace itself.
		const mid = (this.rows - 1) / 2;
		for (let x = 0; x < this.cols; x++) {
			const h = this.heightAt(x, t);
			const row = this.rowFor(h * BODY_SPAN);
			const mirror = this.rowFor(-h * BODY_SPAN);
			const lo = Math.min(row, mirror);
			const hi = Math.max(row, mirror);
			const half = Math.max(1, (hi - lo) / 2);
			for (let y = lo; y <= hi; y++) {
				const toEdge = clamp01(Math.abs(y - mid) / half);
				const v = clamp01(0.34 + toEdge * 0.58 + ditherOffset4x4(x, y) * 0.16);
				const rgb = mix(pairRgb[0], pairRgb[1], toEdge * 0.85);
				put(x, y, densityGlyph(v), 0.24 + v * 0.5, rgb);
			}
		}

		// 3. The trace itself, always the brightest thing in the frame —
		// float rows through `curveGlyph`'s sub-cell ramp instead of
		// `traceGlyph`'s rounded one.
		for (let x = 0; x < this.cols; x++) {
			const h = this.heightAt(x, t);
			const rowF = this.rowFloat(h);
			const prevF = x > 0 ? this.rowFloat(this.heightAt(x - 1, t)) : rowF;
			const energy = this.ripple ? Math.abs(this.ripple.current[x]) : 0;
			const rgb = energy > 0.25 ? hotRgb : pairRgb[0];
			for (let y = 0; y < this.rows; y++) {
				const glyph = curveGlyph(rowF, prevF, y, this.rows);
				if (glyph) put(x, y, glyph, 1, rgb);
			}
		}

		// 4. Paint: one `fillText` per run of same color+alpha in a row —
		// ported verbatim from the prototype's own final loop. Cells now
		// carry per-cell colors (not one flat trace color), so the shared
		// `drawCharGrid` helper (one string per row PER DISTINCT COLOR,
		// padded with spaces) no longer fits; a run of contiguous matching
		// cells is cheaper and matches the ground truth exactly.
		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);
		ctx.textBaseline = 'top';
		for (let y = 0; y < this.rows; y++) {
			this.paintRow(ctx, cells, y);
		}
	}

	private paintRow(ctx: CanvasRenderingContext2D, cells: Array<Cell | null>, y: number): void {
		let run = '';
		let runStartX = 0;
		let key = '';
		let color = '';
		const flush = () => {
			if (run) {
				ctx.fillStyle = color;
				ctx.fillText(run, runStartX * this.cw, y * this.ch);
			}
			run = '';
		};
		for (let x = 0; x < this.cols; x++) {
			const cell = cells[y * this.cols + x];
			if (!cell) {
				flush();
				key = '';
				continue;
			}
			const cellKey = `${cell.rgb[0]},${cell.rgb[1]},${cell.rgb[2]}|${Math.round(cell.alpha * 20) / 20}`;
			if (cellKey !== key) {
				flush();
				key = cellKey;
				color = cssRgba(cell.rgb, cell.alpha);
				runStartX = x;
			}
			run += cell.glyph;
		}
		flush();
	}
}
