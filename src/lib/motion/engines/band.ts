/**
 * The field page's iridescent band engine (owner's explicit PR4 choice — a
 * tall "protagonist" Bayer-dithered band; design motion table "Band
 * /field"). Downscales to a small pixel buffer (one canvas pixel per dither
 * cell, matching the legacy pane-header `Strip` class's approach) so the
 * ordered dither reads as discrete dots once the browser scales the canvas
 * up to its CSS size. Runs as a slow ambient loop while visible; reduced
 * motion renders one static frame.
 *
 * Also draws the hummingbird (design #4938 slice S2: the bird moves from the
 * hero to `/field/`, where its research actually happens — it belongs over
 * the band, not the home sky). It's composited directly into this grid, in
 * the same draw pass, rather than a second canvas/scheduler slot — the band
 * stays the protagonist and the bird is a small, calm, hovering silhouette
 * over it, reusing the exact same pure geometry/motion (`fields/bird.ts`)
 * and palette (`sky-palette.ts`) the home hero used, just recomposited here.
 */
import { makeTexture, sampleTexture } from '../fields/noise';
import { iridescentField } from '../fields/iridescence';
import { passesDither } from '../fields/dither';
import { blendOverRgba } from '../fields/math';
import { birdGeometryScale, computeBirdMotion, sampleBird, type BirdFrame } from '../fields/bird';
import { resolveSkyColor, type SkyColorKey } from './sky-palette';
import { hexToRgb, parseCssColor, type Tokens } from '../runtime/tokens';
import type { Engine } from '../runtime/canvas-action';

/**
 * Where the hummingbird hovers, in the band's own dither-cell grid (one cell
 * = one bitmap pixel = one bird-space "unit-per-`S`"). Proportional to
 * `cols`/`rows`, not fixed pixels, so it stays a comfortably-sized,
 * comfortably-clear-of-the-edges silhouette at any band size. Sized and
 * balanced against `sampleBird`'s own documented bounding box (`fields/bird.ts`:
 * x in [-1.45, 0.88], y in [-0.9, 1.02], which includes the flower) rather
 * than just the body, so nothing — flower included — clips off the band's
 * edges (see the unit tests in `band.test.ts`).
 */
export function computeBirdAnchor(
	cols: number,
	rows: number
): { S: number; ax: number; ay: number } {
	const S = rows * 0.45;
	return { S, ax: cols * 0.62, ay: rows * 0.473 };
}

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
	private bird = { S: 0, ax: 0, ay: 0 };

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

	/** Unused: the shared scheduler's boolean visibility already gates
	 * whether `draw()` runs at all (R1); the ambient band has no separate
	 * "start once past a ratio" behavior the way the timeline's intro does. */
	setVisibility(): void {}

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
		this.bird = computeBirdAnchor(cols, rows);
	}

	draw(now: number): void {
		if (!this.image) return;
		const t = this.reduced ? this.seedT : this.seedT + now / 1000;
		const data = this.image.data;
		const samplePrimary = (x: number, y: number) => sampleTexture(this.texturePrimary, x, y);
		const sampleShimmer = (x: number, y: number) => sampleTexture(this.textureShimmer, x, y);

		// Same pure motion as the home hero used (owner rule: "same calm
		// settings" — 1.1 wingbeats/s, gentle hover/sway), just recomposited
		// here. `birdGeometryScale`'s cell size is `1` (not a CSS px) because
		// this grid's own cell IS the unit — one bitmap pixel per dither cell.
		const frame: BirdFrame = {
			...computeBirdMotion(t, this.reduced),
			...birdGeometryScale(1, 1, this.bird.S)
		};
		const shimmer = Math.floor(t * 1.5);

		for (let y = 0; y < this.rows; y++) {
			const scanline = y % 2 === 1 ? SCANLINE_DIM : 1;
			const birdY = (y + 0.5 - this.bird.ay) / this.bird.S;
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

				const birdX = (x + 0.5 - this.bird.ax) / this.bird.S;
				const bird = sampleBird(birdX, birdY, frame);
				// `eye` is a hole in the head (never drawn — same as the sky
				// engine's bird), so the band underneath shows through untouched.
				if (!bird || bird.key === 'eye') continue;
				const colorKey: SkyColorKey =
					bird.key === 'gorget' && (x + y + shimmer) % 2 === 1 ? 'gorget2' : bird.key;
				const top = parseCssColor(resolveSkyColor(colorKey, this.tokens));
				const blended = blendOverRgba(top, {
					r: data[i],
					g: data[i + 1],
					b: data[i + 2],
					a: data[i + 3] / 255
				});
				data[i] = blended.r;
				data[i + 1] = blended.g;
				data[i + 2] = blended.b;
				data[i + 3] = Math.round(blended.a * 255);
			}
		}

		this.ctx.putImageData(this.image, 0, 0);
	}
}
