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
import { pickGlyph, DENSITY_RAMP } from '../fields/glyphs';
import { resolveSkyColor } from './sky-palette';
import type { Engine } from '../runtime/canvas-action';
import type { Tokens } from '../runtime/tokens';

/** The legacy engine's fixed reduced-motion pose ("Static frame (t=11.3)"). */
const REDUCED_SEED_T = 11.3;
/**
 * Minimum gradient magnitude (in the cloud field's own 0-1 units, sampled
 * one grid cell apart) to treat a cell as a real edge instead of a flat
 * interior (owner decision #4938 item 6: "the theme is ASCII ART, but super
 * advanced" — trace the clouds' shapes with directional glyphs, keep their
 * soft interiors on the density ramp). Tuned against real headless-browser
 * screenshots of the hero at common widths: low enough that cloud silhouette
 * boundaries clearly pick up `- | / \`, high enough that the field's own
 * gentle internal shading doesn't turn into edge noise.
 */
const EDGE_THRESHOLD = 0.16;

export interface SkyEngineOptions {
	canvas: HTMLCanvasElement;
	tokens: Tokens;
	reduced: boolean;
}

function devicePixelRatioCapped(): number {
	if (typeof window === 'undefined') return 1;
	return Math.min(window.devicePixelRatio || 1, 2);
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
		this.width = rect.width;
		this.height = rect.height;

		const dpr = devicePixelRatioCapped();
		this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
		this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
		this.fontSize = rect.width < 560 ? 10 : 12;
		const font = `${this.fontSize}px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.ctx.font = font;
		this.cw = this.ctx.measureText('M').width || this.fontSize * 0.6;
		this.ch = Math.round(this.fontSize * 1.22);

		const cols = Math.max(4, Math.ceil(rect.width / this.cw));
		const rows = Math.max(2, Math.ceil(rect.height / this.ch));
		if (cols !== this.cols || rows !== this.rows) {
			this.cols = cols;
			this.rows = rows;
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

		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);
		ctx.textBaseline = 'top';

		// The gradient-sampling field for directional-glyph selection (owner
		// decision #4938 item 6): the ripple's smooth spatial distortion is
		// included (so a ripple wavefront can itself get outlined), but NOT
		// the per-cell `ditherOffset4x4` jitter added to `value` below — that
		// offset tiles every 4 cells and would inject a fake high-frequency
		// gradient into every flat interior, turning calm cloud fills into
		// edge noise instead of tracing real shapes.
		const cellField = (cx: number, cy: number): number => {
			let fx = cx;
			let fy = cy;
			if (this.ripple && cx > 0 && cy > 0 && cx < this.cols - 1 && cy < this.rows - 1) {
				const i = cy * this.cols + cx;
				const r = this.ripple.current;
				fx += (r[i + 1] - r[i - 1]) * 1.5;
				fy += (r[i + this.cols] - r[i - this.cols]) * 1.5;
			}
			return cloudField(
				(px, py) => sampleTexture(this.textureA, px, py),
				(px, py) => sampleTexture(this.textureB, px, py),
				fx * unitX,
				fy * unitY,
				t,
				heightUnits
			);
		};

		for (let y = 0; y < this.rows; y++) {
			// E4 (perf): batch one string per distinct color key for this row —
			// exactly like the legacy `Sky.prototype.draw`'s `used[key]` row
			// buffers — instead of one fillStyle+fillText call per cell. Draw
			// calls end up bounded by rows x distinct colors, not cell count.
			const rowBatches = new Map<string, string[]>();
			for (let x = 0; x < this.cols; x++) {
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
				const glyph = pickGlyph(cellField, x, y, value, {
					edgeThreshold: EDGE_THRESHOLD,
					ramp: DENSITY_RAMP
				});
				if (glyph === ' ') continue;
				if (boost > 0.35) {
					colorKey = energy > 0 ? 'hotP' : 'hotC';
				} else {
					const hueSample = sampleTexture(this.textureB, X * 0.35 + t * 1.2, Y * 0.35 + 40);
					const hue = hueSample < 0.47 ? 'c' : hueSample < 0.56 ? 'b' : 'm';
					colorKey = `${hue}${value > 0.42 ? '1' : '0'}` as Parameters<typeof resolveSkyColor>[0];
				}

				let batch = rowBatches.get(colorKey);
				if (!batch) {
					batch = new Array<string>(this.cols).fill(' ');
					rowBatches.set(colorKey, batch);
				}
				batch[x] = glyph;
			}

			for (const [colorKey, batch] of rowBatches) {
				ctx.fillStyle = resolveSkyColor(
					colorKey as Parameters<typeof resolveSkyColor>[0],
					this.tokens
				);
				ctx.fillText(batch.join(''), 0, y * this.ch);
			}
		}
	}
}
