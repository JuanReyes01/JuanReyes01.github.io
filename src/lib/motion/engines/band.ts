/**
 * The field page's iridescent band engine (owner's explicit PR4 choice — a
 * tall "protagonist" Bayer-dithered band; design motion table "Band
 * /field"). Downscales to a small pixel buffer (one canvas pixel per dither
 * cell, matching the legacy pane-header `Strip` class's approach) so the
 * ordered dither reads as discrete dots once the browser scales the canvas
 * up to its CSS size. Runs as a slow ambient loop while visible; reduced
 * motion renders one static frame.
 */
import { makeTexture, sampleTexture } from '../fields/noise';
import { iridescentField } from '../fields/iridescence';
import { passesDither } from '../fields/dither';
import { hexToRgb, type Tokens } from '../runtime/tokens';
import type { Engine } from '../runtime/canvas-action';

/** Below this viewport width the dither cell shrinks from 3px to 2px (design motion table). */
const NARROW_BREAKPOINT_PX = 760;
const DESKTOP_CELL_PX = 3;
const NARROW_CELL_PX = 2;
const MIN_COLS = 16;
const MIN_ROWS = 8;
/** Alternating-row scanline dimming (design: "Scanline 0.7"), matching the legacy strip draw loop. */
const SCANLINE_DIM = 0.7;

export interface BandEngineOptions {
	canvas: HTMLCanvasElement;
	tokens: Tokens;
	reduced: boolean;
}

export class BandEngine implements Engine {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private tokens: Tokens;
	private reduced: boolean;

	private readonly texturePrimary = makeTexture(90210);
	private readonly textureShimmer = makeTexture(1337);
	/** A fixed ambient phase offset so every band instance doesn't drift in lockstep. */
	private readonly seedT = 4.2;

	private cols = 0;
	private rows = 0;
	private image: ImageData | null = null;

	constructor(opts: BandEngineOptions) {
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
	}

	isSettled(): boolean {
		return this.reduced;
	}

	destroy(): void {}

	resize(): void {
		const rect = this.canvas.getBoundingClientRect();
		if (!rect.width) return;
		const cellPx = rect.width <= NARROW_BREAKPOINT_PX ? NARROW_CELL_PX : DESKTOP_CELL_PX;
		const cols = Math.max(MIN_COLS, Math.floor(rect.width / cellPx));
		const rows = Math.max(MIN_ROWS, Math.floor(rect.height / cellPx));
		if (cols === this.cols && rows === this.rows) return;
		this.cols = cols;
		this.rows = rows;
		this.canvas.width = cols;
		this.canvas.height = rows;
		this.image = this.ctx.createImageData(cols, rows);
	}

	draw(now: number): void {
		if (!this.image) return;
		const t = this.reduced ? this.seedT : this.seedT + now / 1000;
		const data = this.image.data;
		const samplePrimary = (x: number, y: number) => sampleTexture(this.texturePrimary, x, y);
		const sampleShimmer = (x: number, y: number) => sampleTexture(this.textureShimmer, x, y);

		for (let y = 0; y < this.rows; y++) {
			const scanline = y % 2 === 1 ? SCANLINE_DIM : 1;
			for (let x = 0; x < this.cols; x++) {
				const { value, ink } = iridescentField(samplePrimary, sampleShimmer, x, y, t);
				const i = (y * this.cols + x) * 4;
				if (passesDither(value * scanline, x, y)) {
					const [r, g, b] = hexToRgb(this.tokens[ink]);
					data[i] = r;
					data[i + 1] = g;
					data[i + 2] = b;
					data[i + 3] = 255;
				} else {
					data[i + 3] = 0;
				}
			}
		}

		this.ctx.putImageData(this.image, 0, 0);
	}
}
