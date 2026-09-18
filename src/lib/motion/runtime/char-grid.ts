/**
 * The shared monospace character-grid renderer (owner decision `site/v2-direction`
 * slice S3: "one shared character renderer for all of them"). Every canvas
 * engine that draws a text field — `SkyEngine`, `BandEngine`, and the new
 * full-bleed page headers — sizes its canvas via {@link layoutCharGrid} and
 * paints it via {@link drawCharGrid} instead of re-implementing font
 * measurement or row/color batching by hand. This is engine plumbing (design
 * D14), not a pure field (D1) — it reads `getBoundingClientRect`/sets canvas
 * dimensions — so it lives in `runtime/`, not `fields/`.
 */

/** Every character-grid engine caps DPR at 2 (design D14) — a real backing
 * resolution beyond that buys no visible sharpness for monospace text but
 * doubles (or more) the pixels every `fillText` call has to rasterize. */
export function devicePixelRatioCapped(): number {
	if (typeof window === 'undefined') return 1;
	return Math.min(window.devicePixelRatio || 1, 2);
}

/** The one monospace font stack every character-grid engine's `ctx.font` uses
 * (design D12/D14/R4) — sky, band and the header engines all need the exact
 * same stack so their glyphs line up identically at the same font size. */
export const MONO_FONT_STACK = 'ui-monospace, Menlo, Consolas, monospace';
export const MONO_FONT_NAME = '"JetBrains Mono", ' + MONO_FONT_STACK;

/** What a single grid cell paints: one character, in one color. `null`
 * (or a space glyph) means "skip this cell" — no draw call for it. */
export interface CellPaint {
	glyph: string;
	color: string;
}

interface DrawableCtx {
	fillStyle: string | CanvasGradient | CanvasPattern;
	fillText(text: string, x: number, y: number): void;
}

/**
 * Calls `cellAt(x, y)` for every cell in a `cols`x`rows` grid, batches
 * same-row same-color glyphs into one string per (row, color) pair (design
 * D14 perf rule E4 — draw calls bounded by rows x distinct colors, not cell
 * count), and issues one `fillText` per batch at `(0, y * cellHeight)`.
 * Returns the number of `fillText` calls actually issued, so callers/tests
 * can assert and report the draw-call budget.
 */
export function drawCharGrid(
	ctx: DrawableCtx,
	cols: number,
	rows: number,
	cellHeight: number,
	cellAt: (x: number, y: number) => CellPaint | null
): number {
	let drawCalls = 0;
	for (let y = 0; y < rows; y++) {
		const rowBatches = new Map<string, string[]>();
		for (let x = 0; x < cols; x++) {
			const cell = cellAt(x, y);
			if (!cell || cell.glyph === ' ') continue;
			let batch = rowBatches.get(cell.color);
			if (!batch) {
				batch = new Array<string>(cols).fill(' ');
				rowBatches.set(cell.color, batch);
			}
			batch[x] = cell.glyph;
		}
		for (const [color, batch] of rowBatches) {
			ctx.fillStyle = color;
			ctx.fillText(batch.join(''), 0, y * cellHeight);
			drawCalls++;
		}
	}
	return drawCalls;
}

export interface CharGridLayout {
	width: number;
	height: number;
	cw: number;
	ch: number;
	cols: number;
	rows: number;
}

interface MeasurableCtx {
	font: string;
	setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
	measureText(text: string): { width: number };
}

export interface CharGridDeps {
	canvas: HTMLCanvasElement;
	ctx: MeasurableCtx;
	/** Capped device pixel ratio (callers cap it, e.g. at 2, before passing it in). */
	dpr: number;
	fontPx: number;
	fontFamily: string;
	minCols?: number;
	minRows?: number;
}

/**
 * Sizes a canvas as a monospace character grid: sets the canvas's backing
 * resolution to the CSS rect x `dpr`, sets `ctx.font`, measures one
 * character's advance width/line height, and derives `cols`/`rows` from the
 * CSS rect. Returns `null` for a genuinely unlaid-out canvas (`rect.width`
 * is `0`) — every engine already guards this case the same way.
 */
export function layoutCharGrid(deps: CharGridDeps): CharGridLayout | null {
	const rect = deps.canvas.getBoundingClientRect();
	if (!rect.width) return null;

	deps.canvas.width = Math.max(1, Math.round(rect.width * deps.dpr));
	deps.canvas.height = Math.max(1, Math.round(rect.height * deps.dpr));
	deps.ctx.setTransform(deps.dpr, 0, 0, deps.dpr, 0, 0);
	deps.ctx.font = `${deps.fontPx}px ${deps.fontFamily}`;

	const cw = deps.ctx.measureText('M').width || deps.fontPx * 0.6;
	const ch = Math.round(deps.fontPx * 1.22);
	const cols = Math.max(deps.minCols ?? 4, Math.ceil(rect.width / cw));
	const rows = Math.max(deps.minRows ?? 2, Math.ceil(rect.height / ch));

	return { width: rect.width, height: rect.height, cw, ch, cols, rows };
}
