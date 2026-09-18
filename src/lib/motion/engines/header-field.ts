/**
 * A generic full-bleed ASCII page header (owner decision `site/v2-direction`
 * slice S3, item B: "the header is a wide character field carrying the
 * section's colours ... plus the pointer/touch ripple"), used on every
 * hydrated page's header except home (home keeps `SkyEngine`'s own
 * distinctive multi-hue cloud palette, which already satisfies this — see
 * `engines/sky.ts`). Shares the exact same ambient cloud field + ripple math
 * as `SkyEngine` (`fields/clouds.ts`, `fields/ripple.ts`), rendered as
 * density-ramp characters only through the shared `runtime/char-grid.ts`
 * renderer (owner correction, apply-fix round 1: "ambient fields use the
 * density ramp only" — no directional-edge tracing here, that's reserved
 * for fields with a real shape) — but colors every cell with the
 * CURRENT section's own two accent tokens (`site.ts#colorsForSection`)
 * instead of Sky's fixed rainbow palette, so `/work/`'s header reads in
 * yellow/pink and `/field/`'s would read in green/cyan if it ever used this
 * engine directly (in practice `/field/`'s header IS `BandEngine`, which
 * already carries the field section's colors on its own).
 */
import { sampleTexture, makeTexture } from '../fields/noise';
import { cloudField } from '../fields/clouds';
import { pokeRipple, stepRipple } from '../fields/ripple';
import { clamp01 } from '../fields/math';
import { densityGlyph } from '../fields/glyphs';
import { tokenRgba, type Tokens } from '../runtime/tokens';
import { colorsForSection, type Section } from '../../site';
import {
	drawCharGrid,
	layoutCharGrid,
	devicePixelRatioCapped,
	MONO_FONT_NAME
} from '../runtime/char-grid';
import type { Engine } from '../runtime/canvas-action';

const REDUCED_SEED_T = 6.4;

export interface HeaderFieldEngineOptions {
	canvas: HTMLCanvasElement;
	tokens: Tokens;
	reduced: boolean;
	section: Section;
}

export class HeaderFieldEngine implements Engine {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private tokens: Tokens;
	private reduced: boolean;
	private readonly section: Section;

	private readonly textureA = makeTexture(2027);
	private readonly textureB = makeTexture(4091);

	private width = 0;
	private height = 0;
	private cw = 7;
	private ch = 14;
	private cols = 0;
	private rows = 0;
	private fontSize = 12;

	private ripple: { current: Float32Array; previous: Float32Array } | null = null;

	constructor(opts: HeaderFieldEngineOptions) {
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
		else if (this.cols && this.rows) this.ripple = this.freshRippleBuffers();
	}

	setVisibility(): void {}

	isSettled(): boolean {
		return this.reduced;
	}

	destroy(): void {}

	private freshRippleBuffers() {
		const size = this.cols * this.rows;
		return { current: new Float32Array(size), previous: new Float32Array(size) };
	}

	resize(): void {
		const rect = this.canvas.getBoundingClientRect();
		if (!rect.width) return;
		this.fontSize = rect.width < 560 ? 10 : 12;
		const layout = layoutCharGrid({
			canvas: this.canvas,
			ctx: this.ctx,
			dpr: devicePixelRatioCapped(),
			fontPx: this.fontSize,
			fontFamily: MONO_FONT_NAME
		});
		if (!layout) return;
		this.width = layout.width;
		this.height = layout.height;
		this.cw = layout.cw;
		this.ch = layout.ch;
		if (layout.cols !== this.cols || layout.rows !== this.rows) {
			this.cols = layout.cols;
			this.rows = layout.rows;
			this.ripple = this.reduced ? null : this.freshRippleBuffers();
		}
	}

	/** Adds ripple energy at a pointer/touch position, in canvas-local client coordinates. */
	poke(clientX: number, clientY: number, strength: number): void {
		if (this.reduced || !this.ripple || !this.cols) return;
		const rect = this.canvas.getBoundingClientRect();
		const cellX = Math.floor((clientX - rect.left) / this.cw);
		const cellY = Math.floor((clientY - rect.top) / this.ch);
		pokeRipple(this.ripple.current, this.cols, this.rows, cellX, cellY, strength);
	}

	draw(now: number): void {
		if (!this.cols) return;
		const t = this.reduced ? REDUCED_SEED_T : REDUCED_SEED_T + now / 1000;
		if (!this.reduced && this.ripple) {
			const { next, prev } = stepRipple(
				this.cols,
				this.rows,
				this.ripple.current,
				this.ripple.previous
			);
			this.ripple = { current: next, previous: prev };
		}

		const unitX = this.cw / 3;
		const unitY = this.ch / 3;
		const heightUnits = this.height / 3;
		const { pc, pc2 } = colorsForSection(this.section);
		const primaryColor = this.tokens[pc as keyof Tokens];
		const secondaryColor = this.tokens[pc2 as keyof Tokens];

		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);
		ctx.textBaseline = 'top';

		drawCharGrid(ctx, this.cols, this.rows, this.ch, (x, y) => {
			let sx = x;
			let sy = y;
			let boost = 0;
			if (this.ripple && x > 0 && y > 0 && x < this.cols - 1 && y < this.rows - 1) {
				const i = y * this.cols + x;
				const r = this.ripple.current;
				sx += (r[i + 1] - r[i - 1]) * 1.5;
				sy += (r[i + this.cols] - r[i - this.cols]) * 1.5;
				boost = Math.min(1, Math.abs(r[i]) * 0.28);
			}
			const value = clamp01(
				cloudField(
					(px, py) => sampleTexture(this.textureA, px, py),
					(px, py) => sampleTexture(this.textureB, px, py),
					sx * unitX,
					sy * unitY,
					t,
					heightUnits
				) + boost
			);
			// Owner correction (apply-fix round 1): "ambient fields use the
			// density ramp only" — this cloud field is procedural noise with
			// no real, coherent shape to trace.
			const glyph = densityGlyph(value);
			if (glyph === ' ') return null;
			// E4 (perf): exactly 4 discrete colors total (2 hues x 2 alpha
			// levels), matching `SkyEngine`'s `c0`/`c1` bucketing — a
			// continuous per-cell alpha would produce a near-unique color
			// string every cell and defeat the row/color batching below.
			const hex = value > 0.5 ? secondaryColor : primaryColor;
			const alpha = value > 0.42 ? 0.6 : 0.26;
			return { glyph, color: tokenRgba(hex, alpha) };
		});
	}
}
