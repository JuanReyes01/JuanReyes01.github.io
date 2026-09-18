/**
 * The hero character field (design D14/D15, motion table "Sky /"): ambient
 * cloud drift + a pointer/touch ripple wave, in one monospace character
 * grid — ported from the legacy `Sky` class. Runs as an ambient loop for as
 * long as it's visible (never "settles") unless reduced motion is active, in
 * which case it renders the legacy's fixed `t=11.3` frame with no ripple,
 * matching the spec's static-frame rule.
 *
 * The hummingbird that used to live here moved to `/field/` (design #4938
 * slice S2 — the hummingbird research happens there, not on the home page),
 * where it's drawn directly into `BandEngine`'s own grid (`engines/band.ts`).
 * This engine keeps the cloud field only, which is exactly the "character
 * field" the home hero header now uses full-width behind its text.
 */
import { sampleTexture, makeTexture } from '../fields/noise';
import { cloudField } from '../fields/clouds';
import { pokeRipple, stepRipple } from '../fields/ripple';
import { ditherOffset4x4 } from '../fields/dither';
import { clamp01 } from '../fields/math';
import { densityGlyph } from '../fields/glyphs';
import { resolveSkyColor } from './sky-palette';
import {
	drawCharGrid,
	layoutCharGrid,
	devicePixelRatioCapped,
	MONO_FONT_NAME
} from '../runtime/char-grid';
import type { Engine } from '../runtime/canvas-action';
import type { Tokens } from '../runtime/tokens';

/** The legacy engine's fixed reduced-motion pose ("Static frame (t=11.3)"). */
const REDUCED_SEED_T = 11.3;

/** Medium-intensity port (owner-approved header prototype v5): the ambient
 * cloud field's own clock runs at this multiple of real time — the
 * prototype's intensity control itself is not shipped, so "medium"
 * (multiplier 1) is hard-coded as this single constant, ported verbatim from
 * its own `FIELD_DRIFT`. */
const FIELD_DRIFT = 2.2;

export interface SkyEngineOptions {
	canvas: HTMLCanvasElement;
	tokens: Tokens;
	reduced: boolean;
}

export class SkyEngine implements Engine {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private tokens: Tokens;
	private reduced: boolean;

	private readonly textureA = makeTexture(1337);
	private readonly textureB = makeTexture(90210);

	private width = 0;
	private height = 0;
	private cw = 7;
	private ch = 14;
	private cols = 0;
	private rows = 0;
	private fontSize = 12;

	private ripple: { current: Float32Array; previous: Float32Array } | null = null;

	constructor(opts: SkyEngineOptions) {
		this.canvas = opts.canvas;
		this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
		this.tokens = opts.tokens;
		this.reduced = opts.reduced;
	}

	setTheme(tokens: Tokens): void {
		this.tokens = tokens;
	}

	setReduced(reduced: boolean): void {
		this.reduced = reduced;
		if (reduced) this.ripple = null;
		else if (this.cols && this.rows) this.ripple = this.freshRippleBuffers();
	}

	/** Unused: the shared scheduler's boolean visibility already gates
	 * whether `draw()` runs at all (R1); the ambient sky has no separate
	 * "start once past a ratio" behavior the way the timeline's intro does. */
	setVisibility(): void {}

	isSettled(): boolean {
		// An ambient loop runs for as long as it's visible; only reduced
		// motion's single static frame counts as "settled" (design D15).
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
		const t = this.reduced ? REDUCED_SEED_T : REDUCED_SEED_T + (now / 1000) * FIELD_DRIFT;
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

		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);
		ctx.textBaseline = 'top';

		drawCharGrid(ctx, this.cols, this.rows, this.ch, (x, y) => {
			let colorKey: Parameters<typeof resolveSkyColor>[0];

			let sx = x;
			let sy = y;
			let boost = 0;
			let energy = 0;
			if (this.ripple && x > 0 && y > 0 && x < this.cols - 1 && y < this.rows - 1) {
				const i = y * this.cols + x;
				const r = this.ripple.current;
				energy = r[i];
				sx += (r[i + 1] - r[i - 1]) * 1.5;
				sy += (r[i + this.cols] - r[i - this.cols]) * 1.5;
				boost = Math.min(1, Math.abs(energy) * 0.28);
			}
			const X = sx * unitX;
			const Y = sy * unitY;
			let value = cloudField(
				(px, py) => sampleTexture(this.textureA, px, py),
				(px, py) => sampleTexture(this.textureB, px, py),
				X,
				Y,
				t,
				heightUnits
			);
			value = clamp01(value + boost + ditherOffset4x4(x, y) * 0.09);
			// Owner correction (site/v2-direction slice S3, apply-fix round
			// 1): "ambient fields use the density ramp only" — the cloud
			// field is procedural noise with no real, coherent shape to
			// trace, so it no longer calls `pickGlyph`'s directional-edge
			// logic; a plain density lookup keeps it calm background texture
			// instead of inventing false edges everywhere.
			const glyph = densityGlyph(value);
			if (glyph === ' ') return null;
			if (boost > 0.35) {
				colorKey = energy > 0 ? 'hotP' : 'hotC';
			} else {
				const hueSample = sampleTexture(this.textureB, X * 0.35 + t * 1.2, Y * 0.35 + 40);
				const hue = hueSample < 0.47 ? 'c' : hueSample < 0.56 ? 'b' : 'm';
				colorKey = `${hue}${value > 0.42 ? '1' : '0'}` as Parameters<typeof resolveSkyColor>[0];
			}
			return { glyph, color: resolveSkyColor(colorKey, this.tokens) };
		});
	}
}
