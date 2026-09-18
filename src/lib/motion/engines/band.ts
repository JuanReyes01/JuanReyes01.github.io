/**
 * The field page's iridescent band engine (owner's explicit PR4 choice — a
 * tall "protagonist" band; design motion table "Band /field"). Owner verdict
 * `site/v2-direction` slice S3 ("the hummingbird looks wrong"): this used to
 * write raw `ImageData` pixels — a dither of coloured dots, never actual
 * characters — so the bird composited into it rendered as coloured blobs,
 * not ASCII. It now renders as a real monospace CHARACTER grid, exactly like
 * `SkyEngine` (same `layoutCharGrid`/`drawCharGrid` shared renderer), so the
 * band itself and the hummingbird are BOTH drawn with characters.
 *
 * The band's own texture keeps the exact same field maths as before
 * (`iridescentField` + the ordered Bayer dither from `dither.ts` decides
 * which cells are "lit" at all) — only WHAT gets drawn into a lit cell
 * changed: a glyph chosen by `pickGlyph` (directional edge glyph at a field
 * boundary, density-ramp character in a flat interior) instead of a flat
 * colored pixel.
 *
 * The hummingbird (design #4938 slice S2: the bird moves from the hero to
 * `/field/`) is composited into the SAME grid, in the same draw pass, reusing
 * the exact pure geometry/motion (`fields/bird.ts`) and palette
 * (`sky-palette.ts`) the home hero used. Its edges are traced with the same
 * directional-glyph technique (owner decision #4938 item 6: "the theme is
 * ASCII ART, but super advanced") instead of being forced to a solid pixel
 * outline — the bird now reads as a hummingbird DRAWN WITH CHARACTERS, not a
 * pixel silhouette.
 */
import { makeTexture, sampleTexture } from '../fields/noise';
import { iridescentField } from '../fields/iridescence';
import { clamp01 } from '../fields/math';
import { pickGlyph, DENSITY_RAMP } from '../fields/glyphs';
import { birdGeometryScale, computeBirdMotion, sampleBird, type BirdFrame } from '../fields/bird';
import { resolveSkyColor, type SkyColorKey } from './sky-palette';
import type { Tokens } from '../runtime/tokens';
import {
	drawCharGrid,
	layoutCharGrid,
	devicePixelRatioCapped,
	MONO_FONT_NAME
} from '../runtime/char-grid';
import type { Engine } from '../runtime/canvas-action';

/**
 * A bird anchor in REAL PHYSICAL PIXELS (CSS px), not grid cells — unlike a
 * pixel-dither raster (one canvas pixel == one physical px, always square),
 * a monospace character cell is NOT square (`cw` != `ch`), so sampling the
 * bird directly in cell-index space would stretch its silhouette by the
 * font's own aspect ratio. Anchoring in physical pixels and converting each
 * cell to its physical center before sampling (see `draw()`) keeps the bird
 * round on screen regardless of font metrics. Proportional to the band's own
 * size, not a fixed pixel size, so it stays a comfortably-sized,
 * comfortably-clear-of-the-edges silhouette at any band size — sized and
 * balanced against `sampleBird`'s own documented bounding box (`fields/bird.ts`:
 * x in [-1.45, 0.88], y in [-0.9, 1.02], which includes the flower), verified
 * in `band.test.ts`.
 */
export function computeBirdAnchor(
	widthPx: number,
	heightPx: number
): { S: number; ax: number; ay: number } {
	const S = heightPx * 0.45;
	return { S, ax: widthPx * 0.62, ay: heightPx * 0.473 };
}

/** Converts a physical pixel position into the hummingbird's own normalized
 * bird-space coordinates (see `fields/bird.ts`) relative to `anchor` — one
 * `anchor.S` of physical distance on EITHER axis is exactly one bird-space
 * unit, which is what keeps the bird circular in real pixels no matter the
 * font's cell aspect ratio (see {@link computeBirdAnchor}'s doc comment). */
export function birdSpaceOf(
	px: number,
	py: number,
	anchor: { S: number; ax: number; ay: number }
): { bx: number; by: number } {
	return { bx: (px - anchor.ax) / anchor.S, by: (py - anchor.ay) / anchor.S };
}

/**
 * Minimum cell-space gradient magnitude of the bird's own ramp-value field
 * (0 outside the bird, the part's ramp value inside — see `draw()`'s
 * `birdField`) to trace a directional edge glyph (`- | / \`) instead of the
 * density-ramp character (owner decision #4938 item 6: "the theme is ASCII
 * ART, but super advanced" — shapes should read as drawn, not a blob).
 * Tuned against real headless-browser screenshots of the band at common
 * widths, the same way `SkyEngine`'s `EDGE_THRESHOLD` was tuned.
 */
const BIRD_EDGE_THRESHOLD = 0.55;

/** Same idea as {@link BIRD_EDGE_THRESHOLD}, tuned for the ambient
 * iridescent field's own (much smoother) gradient instead of the bird's. */
const FIELD_EDGE_THRESHOLD = 0.12;

/** Below this viewport width the font shrinks for a denser character grid
 * (design motion table's dither-cell breakpoint, carried over to font size). */
const NARROW_BREAKPOINT_PX = 760;
const DESKTOP_FONT_PX = 9;
const NARROW_FONT_PX = 7;
const MIN_COLS = 24;
const MIN_ROWS = 10;
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

	private width = 0;
	private height = 0;
	private cw = 6;
	private ch = 11;
	private cols = 0;
	private rows = 0;
	private fontPx = DESKTOP_FONT_PX;
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
		this.fontPx = rect.width <= NARROW_BREAKPOINT_PX ? NARROW_FONT_PX : DESKTOP_FONT_PX;
		const layout = layoutCharGrid({
			canvas: this.canvas,
			ctx: this.ctx,
			dpr: devicePixelRatioCapped(),
			fontPx: this.fontPx,
			fontFamily: MONO_FONT_NAME,
			minCols: MIN_COLS,
			minRows: MIN_ROWS
		});
		if (!layout) return;
		this.width = layout.width;
		this.height = layout.height;
		this.cw = layout.cw;
		this.ch = layout.ch;
		this.cols = layout.cols;
		this.rows = layout.rows;
		this.bird = computeBirdAnchor(this.width, this.height);
	}

	draw(now: number): void {
		if (!this.cols || !this.rows) return;
		const t = this.reduced ? this.seedT : this.seedT + now / 1000;
		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);
		ctx.textBaseline = 'top';

		const samplePrimary = (x: number, y: number) => sampleTexture(this.texturePrimary, x, y);
		const sampleShimmer = (x: number, y: number) => sampleTexture(this.textureShimmer, x, y);
		const fieldValueAt = (cx: number, cy: number): number =>
			iridescentField(samplePrimary, sampleShimmer, cx, cy, t).value;

		// Same pure motion as the home hero used (owner rule: "same calm
		// settings" — 1.1 wingbeats/s, gentle hover/sway), just recomposited
		// here, now scaled from REAL physical cell/bird pixel sizes.
		const frame: BirdFrame = {
			...computeBirdMotion(t, this.reduced),
			...birdGeometryScale(this.ch, this.cw, this.bird.S)
		};
		const shimmer = Math.floor(t * 1.5);

		// The bird's own ramp-value field, sampled at a cell's PHYSICAL
		// center (not raw cell index — see `birdSpaceOf`'s doc comment) so
		// its silhouette stays round regardless of the font's cell aspect
		// ratio. `0` outside the bird entirely (including over its own `eye`
		// hole), the part's ramp value inside.
		const birdField = (cx: number, cy: number): number => {
			const { bx, by } = birdSpaceOf((cx + 0.5) * this.cw, (cy + 0.5) * this.ch, this.bird);
			const sample = sampleBird(bx, by, frame);
			return sample && sample.key !== 'eye' ? sample.value : 0;
		};

		drawCharGrid(ctx, this.cols, this.rows, this.ch, (x, y) => {
			const { bx, by } = birdSpaceOf((x + 0.5) * this.cw, (y + 0.5) * this.ch, this.bird);
			const bird = sampleBird(bx, by, frame);
			// `eye` is a hole in the head (never drawn — same as the sky
			// engine's bird), so the band underneath shows through untouched.
			if (bird && bird.key !== 'eye') {
				const glyph = pickGlyph(birdField, x, y, bird.value, {
					edgeThreshold: BIRD_EDGE_THRESHOLD,
					ramp: DENSITY_RAMP
				});
				if (glyph !== ' ') {
					const colorKey: SkyColorKey =
						bird.key === 'gorget' && (x + y + shimmer) % 2 === 1 ? 'gorget2' : bird.key;
					return { glyph, color: resolveSkyColor(colorKey, this.tokens) };
				}
			}

			// Owner instruction (site/v2-direction slice S3, item A): "same
			// iridescent field maths, now sampled to glyphs" — the scanline
			// dimming and density now shape which DENSITY_RAMP character a
			// cell gets (like `SkyEngine`'s cloud field), instead of gating
			// whether the cell draws anything at all via the old ordered
			// Bayer dither (`passesDither`) — that gate was tuned for a fine
			// per-pixel raster and left the coarser character grid looking
			// like sparse stars, not "a wide, dense character field."
			const scanline = y % 2 === 1 ? SCANLINE_DIM : 1;
			const { value, ink } = iridescentField(samplePrimary, sampleShimmer, x, y, t);
			const glyph = pickGlyph(fieldValueAt, x, y, clamp01(value * scanline), {
				edgeThreshold: FIELD_EDGE_THRESHOLD,
				ramp: DENSITY_RAMP
			});
			if (glyph === ' ') return null;
			return { glyph, color: this.tokens[ink] };
		});
	}
}
