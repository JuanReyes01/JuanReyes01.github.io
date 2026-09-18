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
import { pokeRipple, stepRipple } from '../fields/ripple';
import { clamp01 } from '../fields/math';
import { pickGlyph, densityGlyph, DENSITY_RAMP } from '../fields/glyphs';
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
 * size, not a fixed pixel size. The hummingbird's own bounding box
 * (`fields/bird.ts`'s early-exit bounds, flower included): x in
 * [-1.45, 0.88], y in [-0.9, 1.02]. Its midpoint is what this centers in the
 * frame — see `band.test.ts`.
 */
const BIRD_BBOX_X_MID = (0.88 + -1.45) / 2;
const BIRD_BBOX_Y_MID = (1.02 + -0.9) / 2;

export function computeBirdAnchor(
	widthPx: number,
	heightPx: number
): { S: number; ax: number; ay: number } {
	// Owner correction (site/v2-direction slice S3, apply-fix round 1):
	// "the bird is the star of /field/ and it is far too small... make it
	// dominate that header... centred in the composition with the flower."
	// Roughly 2-3x the original 0.45 coefficient — at a typical header
	// aspect ratio (wide, short), a bird this size legitimately bleeds past
	// the frame's top/bottom edge (like a photo crop) rather than shrinking
	// to guarantee zero clipping, which would defeat "obvious at a glance."
	const S = heightPx * 0.62;
	return {
		S,
		ax: widthPx * 0.5 - BIRD_BBOX_X_MID * S,
		ay: heightPx * 0.5 - BIRD_BBOX_Y_MID * S
	};
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

/** Owner correction (apply-fix round 1): "keep the ambient field quiet
 * behind it (lower contrast/density) so the bird reads instantly." Scales
 * the field's own density value down before the ramp lookup, so fewer
 * cells clear the density ramp's brighter characters. */
const FIELD_DIM = 0.62;

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
	/** Pointer/touch ripple through the field (owner decision `site/v2-direction`
	 * slice S3, item B: "plus the pointer/touch ripple", on every full-bleed
	 * header — `/field/`'s header IS this band). Same mechanism as
	 * `SkyEngine`'s ripple (`fields/ripple.ts`), displacing the iridescent
	 * field's sample coordinates only — the hummingbird keeps its own
	 * deterministic flight, untouched by pointer interaction. */
	private ripple: { current: Float32Array; previous: Float32Array } | null = null;

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
		if (reduced) this.ripple = null;
		else if (this.cols && this.rows) this.ripple = this.freshRippleBuffers();
	}

	private freshRippleBuffers() {
		const size = this.cols * this.rows;
		return { current: new Float32Array(size), previous: new Float32Array(size) };
	}

	/** Adds ripple energy at a pointer/touch position, in canvas-local client coordinates. */
	poke(clientX: number, clientY: number, strength: number): void {
		if (this.reduced || !this.ripple || !this.cols) return;
		const rect = this.canvas.getBoundingClientRect();
		const cellX = Math.floor((clientX - rect.left) / this.cw);
		const cellY = Math.floor((clientY - rect.top) / this.ch);
		pokeRipple(this.ripple.current, this.cols, this.rows, cellX, cellY, strength);
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
		const gridChanged = layout.cols !== this.cols || layout.rows !== this.rows;
		this.width = layout.width;
		this.height = layout.height;
		this.cw = layout.cw;
		this.ch = layout.ch;
		this.cols = layout.cols;
		this.rows = layout.rows;
		this.bird = computeBirdAnchor(this.width, this.height);
		if (gridChanged) this.ripple = this.reduced ? null : this.freshRippleBuffers();
	}

	draw(now: number): void {
		if (!this.cols || !this.rows) return;
		const t = this.reduced ? this.seedT : this.seedT + now / 1000;
		if (!this.reduced && this.ripple) {
			const { next, prev } = stepRipple(
				this.cols,
				this.rows,
				this.ripple.current,
				this.ripple.previous
			);
			this.ripple = { current: next, previous: prev };
		}
		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);
		ctx.textBaseline = 'top';

		const samplePrimary = (x: number, y: number) => sampleTexture(this.texturePrimary, x, y);
		const sampleShimmer = (x: number, y: number) => sampleTexture(this.textureShimmer, x, y);
		// Displaces the field's sample coordinates only (owner decision:
		// every header gets a pointer/touch ripple) — no gradient sampling
		// needed here now, since the ambient field is density-only (see the
		// `densityGlyph` call below).
		const rippleOffset = (x: number, y: number): { dx: number; dy: number } => {
			if (!this.ripple || x <= 0 || y <= 0 || x >= this.cols - 1 || y >= this.rows - 1) {
				return { dx: 0, dy: 0 };
			}
			const i = y * this.cols + x;
			const r = this.ripple.current;
			return { dx: (r[i + 1] - r[i - 1]) * 1.5, dy: (r[i + this.cols] - r[i - this.cols]) * 1.5 };
		};

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
			// dimming and density shape which DENSITY_RAMP character a cell
			// gets (like `SkyEngine`'s cloud field), instead of gating
			// whether the cell draws anything at all via the old ordered
			// Bayer dither (`passesDither`).
			//
			// Owner correction (apply-fix round 1): (a) "ambient fields use
			// the density ramp only" — this is procedural noise with no real
			// shape to trace, so no `pickGlyph` edge tracing here (that's
			// reserved for the bird below). (b) "keep the ambient field
			// quiet behind it (lower contrast/density) so the bird reads
			// instantly" — `FIELD_DIM` scales the density down.
			const scanline = y % 2 === 1 ? SCANLINE_DIM : 1;
			const { dx, dy } = rippleOffset(x, y);
			const { value, ink } = iridescentField(samplePrimary, sampleShimmer, x + dx, y + dy, t);
			const glyph = densityGlyph(clamp01(value * scanline * FIELD_DIM));
			if (glyph === ' ') return null;
			return { glyph, color: this.tokens[ink] };
		});
	}
}
