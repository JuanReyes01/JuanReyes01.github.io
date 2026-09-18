/**
 * The per-build ASCII waveform strip on `/work/` (owner decision
 * `site/v2-direction` slice S3, item D): "an ASCII waveform in/next to the
 * work header field. The pointer deforms it (1D damped wave, like the hero
 * ripple), and hovering or focusing a build row changes its signature
 * deterministically." Renders as a single traced line (an oscilloscope-style
 * strip, not a filled character field like Sky/Band/HeaderField) through the
 * shared `runtime/char-grid.ts` renderer. Each column's row is chosen by the
 * wave's height there; when adjacent columns land on different rows, EVERY
 * row between them is filled at that column with a connecting glyph (a
 * classic ASCII line-plot technique) so the trace reads as one continuous
 * stroke instead of a dashed staircase — `/`/`\` for a moderate rise/fall,
 * `|` only once the jump is steep enough to read as near-vertical, and
 * `_`/`-`/`‾` for flat runs (chosen by the row's own position — bottom,
 * middle, top — so a flat trough/crest doesn't read as a plain flat line).
 *
 * Owner rule: "It must stay subtle: animate on interaction (and at most a
 * slow ambient drift), never competing with the timeline." This engine
 * never fully settles while visible (same as every other ambient field
 * here), but its own time multiplier is deliberately slow (see
 * `AMBIENT_DRIFT_SPEED`) so the idle drift stays calm; reduced motion still
 * renders one static frame like every other engine.
 */
import {
	deriveWaveSignature,
	sampleWaveform,
	pokeWave1D,
	stepWave1D,
	traceGlyph,
	waveformPokeAmount,
	DISPLAY_GAIN,
	type WaveSignature
} from '../fields/waveform';
import { clamp, clamp01 } from '../fields/math';
import { tokenRgba, type Tokens } from '../runtime/tokens';
import { colorsForSection, type Section } from '../../site';
import {
	drawCharGrid,
	layoutCharGrid,
	devicePixelRatioCapped,
	MONO_FONT_NAME
} from '../runtime/char-grid';
import type { Engine } from '../runtime/canvas-action';

/** A sane floor so a not-yet-laid-out or degenerate-height canvas still gets
 * a few rows of vertical travel — the real row count now tracks the actual
 * canvas height (approved header prototype port: the waveform fills the
 * WHOLE header banner, not a fixed strip below it), so this is a minimum,
 * not the row count itself. */
const MIN_ROWS = 5;
const FONT_PX = 11;
const REDUCED_SEED_T = 3;
/** Deliberately slow — "at most a slow ambient drift" (owner rule): the
 * strip is always technically animating while visible (never `isSettled()`),
 * but this keeps the idle motion calm rather than lively. */
const AMBIENT_DRIFT_SPEED = 0.12;
/** The default, calm signature shown before any build has been hovered/focused. */
const DEFAULT_SIGNATURE: WaveSignature = deriveWaveSignature('default');

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

	private width = 0;
	private height = 0;
	private cw = 7;
	private ch = 14;
	private cols = 0;
	private rows = MIN_ROWS;

	private signature: WaveSignature = DEFAULT_SIGNATURE;
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

	draw(now: number): void {
		if (!this.cols) return;
		const t = this.reduced ? REDUCED_SEED_T : REDUCED_SEED_T + (now / 1000) * AMBIENT_DRIFT_SPEED;
		if (!this.reduced && this.ripple) {
			const { next, prev } = stepWave1D(this.cols, this.ripple.current, this.ripple.previous);
			this.ripple = { current: next, previous: prev };
		}

		const heightAt = (col: number): number => {
			const xn = this.cols > 1 ? col / (this.cols - 1) : 0;
			const base = sampleWaveform(xn, this.signature, t);
			const displaced = this.ripple ? base + this.ripple.current[col] * 0.5 : base;
			return clamp(displaced * DISPLAY_GAIN, -1, 1);
		};
		const rowAt = (col: number): number => {
			const h = heightAt(col);
			return Math.round(clamp01((1 - h) / 2) * (this.rows - 1));
		};

		const { pc } = colorsForSection(this.section);
		const color = tokenRgba(this.tokens[pc as keyof Tokens], 0.85);

		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);
		ctx.textBaseline = 'top';

		drawCharGrid(ctx, this.cols, this.rows, this.ch, (x, y) => {
			const row = rowAt(x);
			const prevRow = x > 0 ? rowAt(x - 1) : row;
			const glyph = traceGlyph(row, prevRow, y, this.rows);
			return glyph ? { glyph, color } : null;
		});
	}
}
