/**
 * The career timeline canvas engine on `/work/` (design D4/D14/D15, motion
 * table "Timeline"; v2 direction slice S1 killed the automatic epoch sweep —
 * the graph renders complete and at rest at HEAD from the first frame).
 * Consumes the pure domain grid/playback/readout modules and the cell-visual
 * rules from `timeline-visuals.ts`; owns only the canvas 2D drawing and the
 * `Engine` lifecycle. Interaction (pointer, touch, keyboard) is wired by
 * `motion/actions/timeline.ts`, which calls this engine's
 * `scrub`/`key`/`release`/`setFocusLane` methods.
 */
import { buildGrid } from '../../domain/git-graph';
import { layoutFor } from '../../domain/layout';
import { reduce, positionAt, type Playback } from '../../domain/playback';
import { readoutAt, type Readout } from '../../domain/readout';
import type { Grid, LayoutResult, Timeline } from '../../domain/types';
import { cellColor, cellVisualState } from './timeline-visuals';
import type { Engine } from '../runtime/canvas-action';
import { tokenRgba, type Tokens } from '../runtime/tokens';

const ROWS_HEIGHT_RATIO = 1.4;
const MAX_CELL_PX = 10.5;
const PLAYHEAD_FILL_ALPHA = 0.16;

export interface TimelineEngineOptions {
	canvas: HTMLCanvasElement;
	timeline: Timeline;
	tokens: Tokens;
	reduced: boolean;
	now: () => number;
	wake: () => void;
	onReadout?: (readout: Readout) => void;
}

function devicePixelRatioCapped(): number {
	if (typeof window === 'undefined') return 1;
	return Math.min(window.devicePixelRatio || 1, 2);
}

export class TimelineEngine implements Engine {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private readonly timeline: Timeline;
	private tokens: Tokens;
	private reduced: boolean;
	private readonly now: () => number;
	private readonly wake: () => void;
	private readonly onReadout?: (readout: Readout) => void;

	private layout: LayoutResult;
	private grid: Grid;
	private cw = 0;
	private ch = 0;
	private width = 0;

	private state: Playback;
	private settled = true;
	private lastMonth = -1;

	constructor(opts: TimelineEngineOptions) {
		this.canvas = opts.canvas;
		this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
		this.timeline = opts.timeline;
		this.tokens = opts.tokens;
		this.reduced = opts.reduced;
		this.now = opts.now;
		this.wake = opts.wake;
		this.onReadout = opts.onReadout;

		this.layout = layoutFor(0, this.timeline);
		this.grid = buildGrid(this.timeline, this.layout);
		// The graph renders complete and at rest at HEAD from the very first
		// frame (owner decision, v2 direction slice S1: "kill the timeline's
		// automatic epoch sweep" — no intro plays, nothing dims or animates
		// without user input).
		this.state = { mode: 'rest', P: opts.timeline.last, releasedAt: 0, focusLane: null };
	}

	private context() {
		return {
			last: this.timeline.last,
			epoch: this.timeline.epoch,
			step: this.layout.step
		};
	}

	resize(): void {
		const rect = this.canvas.getBoundingClientRect();
		const width = rect.width;
		if (!width) return;
		this.width = width;

		this.layout = layoutFor(width, this.timeline);
		this.grid = buildGrid(this.timeline, this.layout);

		this.cw = Math.min(width / this.layout.cols, MAX_CELL_PX);
		const fontSize = this.cw / 0.6;
		this.ch = Math.round(fontSize * ROWS_HEIGHT_RATIO);
		const height = this.layout.rows * this.ch;
		this.canvas.style.height = `${height}px`;

		// Assigning canvas.width/height resets the whole 2D context — including
		// `font` — back to its defaults, so `font` must be re-set AFTER this,
		// on every resize, exactly like the sky engine does (E1: this used to
		// never be set at all, silently falling back to the browser default
		// sans-serif font at the default size).
		const dpr = devicePixelRatioCapped();
		this.canvas.width = Math.round(width * dpr);
		this.canvas.height = Math.round(height * dpr);
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;

		// Repaint immediately with the current playhead. `canvas.width = ...`
		// above just wiped the bitmap, and the shared scheduler (design D14)
		// only redraws a settled engine once something marks it dirty,
		// throttled to ~one redraw per 40ms. A ResizeObserver that fires more
		// than once inside that window — common while fonts/layout settle,
		// worse on narrower viewports with more text reflow (font swap, Row
		// lines wrapping, the Figlet header wrapping) — used to leave the
		// canvas wiped-but-unpainted for a real, visible stretch. Painting
		// here closes that gap instead of waiting on the scheduler's next tick.
		this.render(this.state.P);
	}

	setTheme(tokens: Tokens): void {
		this.tokens = tokens;
	}

	setReduced(reduced: boolean): void {
		this.reduced = reduced;
		if (reduced) {
			this.state = { ...this.state, mode: 'rest', P: this.timeline.last, releasedAt: 0 };
			this.settled = true;
		}
	}

	/** Unused: the shared scheduler's boolean visibility already gates whether
	 * `draw()` runs at all (R1). The timeline has no automatic intro left to
	 * gate on a finer visibility ratio (owner decision, v2 direction slice
	 * S1: "kill the timeline's automatic epoch sweep") — same no-op as the
	 * sky and band engines. */
	setVisibility(): void {}

	isSettled(): boolean {
		return this.settled;
	}

	destroy(): void {
		// The scheduler unregisters this engine and the canvas element is
		// removed by Svelte — nothing else to release here.
	}

	/** Converts a pointer's `clientX` into the target month, clamped to the timeline's range. */
	monthAtClientX(clientX: number): number {
		const rect = this.canvas.getBoundingClientRect();
		const col = Math.floor((clientX - rect.left) / this.cw);
		const month = this.timeline.epoch + (col - this.layout.lab) * this.layout.step;
		return Math.min(this.timeline.last, Math.max(this.timeline.epoch, month));
	}

	/** Scrubs the playhead to an absolute month (pointer/touch/keyboard input from the action layer). */
	scrub(month: number): void {
		this.state = reduce(this.state, { type: 'scrub', P: month }, this.now(), this.context());
		this.wake();
	}

	/** Arrow/Home/End key input, delegating the step math to the domain reducer. */
	key(key: string): void {
		this.state = reduce(this.state, { type: 'key', key }, this.now(), this.context());
		this.wake();
	}

	/** Pointer/touch release: the domain reducer decides whether to glide back to HEAD. */
	release(): void {
		this.state = reduce(this.state, { type: 'release' }, this.now(), this.context());
		this.wake();
	}

	/** Row hover/focus (design motion table: "moves the playhead to its start"). Wiring lands in PR5. */
	setFocusLane(id: string | null): void {
		this.state = reduce(this.state, { type: 'focusLane', id }, this.now(), this.context());
		if (id) {
			const lane = this.timeline.lanes.find((l) => l.id === id);
			if (lane) this.scrub(lane.m0);
		}
		this.wake();
	}

	draw(now: number): void {
		const { P, settled } = positionAt(this.state, now, { last: this.timeline.last });
		this.settled = settled;
		this.state = { ...this.state, P };

		const month = Math.min(this.timeline.last, Math.floor(P));
		if (month !== this.lastMonth) {
			this.lastMonth = month;
			this.onReadout?.(readoutAt(this.timeline, month));
		}

		this.render(P);
	}

	private render(playhead: number): void {
		const ctx = this.ctx;
		const { cols, rows } = this.layout;
		const cw = this.cw;
		const ch = this.ch;

		ctx.clearRect(0, 0, this.width, rows * ch);

		const playheadCol =
			this.layout.lab + Math.floor((Math.floor(playhead) - this.timeline.epoch) / this.layout.step);
		ctx.globalAlpha = 1;
		ctx.fillStyle = tokenRgba(this.tokens.pink, PLAYHEAD_FILL_ALPHA);
		ctx.fillRect(playheadCol * cw, ch * 1.5, cw, (rows - 1.5) * ch);

		ctx.textBaseline = 'middle';
		ctx.textAlign = 'left';

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const cell = this.grid.cells[r][c];
				if (!cell.chs || cell.chs === ' ') continue;
				const visual = cellVisualState(cell, playhead, this.state.focusLane, this.reduced);
				ctx.globalAlpha = visual.alpha;
				ctx.fillStyle = cellColor(cell, this.tokens);
				if (visual.glow) {
					ctx.shadowColor = ctx.fillStyle;
					ctx.shadowBlur = 10;
				}
				ctx.fillText(visual.glyph, c * cw, (r + 0.5) * ch);
				if (visual.glow) ctx.shadowBlur = 0;
			}
		}

		ctx.globalAlpha = 1;
		ctx.fillStyle = this.tokens.magenta;
		ctx.fillText('▼', playheadCol * cw, 1.5 * ch);
	}
}
