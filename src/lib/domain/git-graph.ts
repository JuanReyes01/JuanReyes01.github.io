import type {
	Grid,
	GridCell,
	GridCellKind,
	GridColor,
	Lane,
	LayoutResult,
	Timeline
} from './types';

const HEAD_LABEL = 'HEAD';
const TRUNK_LABEL = 'main';
const TRUNK_ROW = 2;

/** Characters that make a crossing vertical render as `┼` instead of `│`. */
const CROSSING_CHARS = new Set(['━', '─', '●', '╰', '╯', '╮']);

function emptyCell(): GridCell {
	return { chs: ' ', kind: 'empty' };
}

/** Column for an absolute `month`, floor-rounded like the legacy engine's `cOf`. */
function colForMonth(t: Timeline, l: LayoutResult, month: number): number {
	return l.lab + Math.floor((month - t.epoch) / l.step);
}

/** Absolute month for a column with no explicit month of its own (legacy `mOf`). */
function monthForCol(t: Timeline, l: LayoutResult, col: number): number {
	return t.epoch + (col - l.lab) * l.step;
}

function put(
	grid: GridCell[][],
	row: number,
	col: number,
	chs: string,
	kind: GridCellKind,
	color: GridColor | undefined,
	lane: string | undefined,
	mon: number | undefined
): void {
	if (row < 0 || row >= grid.length) return;
	const rowCells = grid[row];
	if (col < 0 || col >= rowCells.length) return;
	rowCells[col] = { chs, kind, color, lane, mon };
}

function text(
	grid: GridCell[][],
	row: number,
	col: number,
	s: string,
	color: GridColor | undefined,
	lane: string | undefined,
	mon?: number
): void {
	for (let i = 0; i < s.length; i++) {
		put(grid, row, col + i, s.charAt(i), 'label', color, lane, mon);
	}
}

function vline(
	grid: GridCell[][],
	col: number,
	row0: number,
	row1: number,
	color: GridColor,
	lane: string,
	mon: number
): void {
	for (let row = row0 + 1; row < row1; row++) {
		const current = grid[row]?.[col];
		const crosses = current !== undefined && CROSSING_CHARS.has(current.chs);
		put(grid, row, col, crosses ? '┼' : '│', 'v', color, lane, mon);
	}
}

/**
 * Renders the timeline as a git-graph-style ASCII grid, matching the legacy
 * canvas engine's `Timeline.prototype.build` glyph-for-glyph (design D4):
 * a year axis, a trunk row labeled "main" ending at a HEAD commit, one row
 * per lane (corner + commit dots + a heavy run), trunk fork/merge marks,
 * verticals that cross to `┼` where they meet an already-drawn cell, and a
 * one-row promotion link between a parent lane and its child.
 */
export function buildGrid(t: Timeline, l: LayoutResult): Grid {
	const cells: GridCell[][] = Array.from({ length: l.rows }, () =>
		Array.from({ length: l.cols }, emptyCell)
	);
	const byId = new Map<string, Lane>(t.lanes.map((lane) => [lane.id, lane]));
	const endC = colForMonth(t, l, t.last);

	drawYearAxis(cells, t, l, endC);
	drawTrunk(cells, t, l, endC);
	for (const lane of t.lanes) drawLane(cells, t, l, lane);
	for (const lane of t.lanes) drawConnectors(cells, t, l, lane, byId);

	return { rows: l.rows, cols: l.cols, cells };
}

function drawYearAxis(cells: GridCell[][], t: Timeline, l: LayoutResult, endC: number): void {
	for (let c = l.lab; c <= endC; c++) {
		put(cells, 1, c, '─', 'axis', 'neutral', undefined, monthForCol(t, l, c));
	}

	const epochYear = Math.floor(t.epoch / 12);
	const lastYear = Math.floor(t.last / 12);
	let nextLabelCol = Infinity;
	for (let year = lastYear; year >= epochYear; year--) {
		// The epoch's own year is ticked at the epoch month itself (it rarely
		// starts in January); every later year is ticked at its January.
		const month = year === epochYear ? t.epoch : year * 12;
		const yc = colForMonth(t, l, month);
		put(cells, 1, yc, '┬', 'axis', 'neutral', undefined, month);
		if (yc + 5 <= nextLabelCol) {
			text(cells, 0, yc, String(year), 'neutral', undefined, month);
			nextLabelCol = yc;
		}
	}
}

function drawTrunk(cells: GridCell[][], t: Timeline, l: LayoutResult, endC: number): void {
	if (l.lab) text(cells, TRUNK_ROW, 1, TRUNK_LABEL, 'neutral', 'trunk');
	for (let c = colForMonth(t, l, t.epoch); c < endC; c++) {
		put(cells, TRUNK_ROW, c, '─', 'trunk', 'neutral', 'trunk', monthForCol(t, l, c));
	}
	put(cells, TRUNK_ROW, endC, '●', 'head', 'neutral', 'trunk', t.last);
	text(cells, 3, endC - 2, HEAD_LABEL, 'neutral', 'trunk');
}

function drawLane(cells: GridCell[][], t: Timeline, l: LayoutResult, lane: Lane): void {
	const s = colForMonth(t, l, lane.m0);
	const e = colForMonth(t, l, lane.m1);

	if (l.lab) text(cells, lane.row, 1, lane.label, lane.color, lane.id);
	for (let c = s + 1; c < e; c++) {
		put(cells, lane.row, c, '━', 'h', lane.color, lane.id, monthForCol(t, l, c));
	}
	put(cells, lane.row, s, '╰', 'corner', lane.color, lane.id, lane.m0);
	if (e - s >= 2) put(cells, lane.row, s + 1, '●', 'commit', lane.color, lane.id, lane.m0);

	if (lane.head) {
		put(cells, lane.row, e, '●', 'commit', lane.color, lane.id, lane.m1);
	} else if (lane.into) {
		put(cells, lane.row, e, '╮', 'corner', lane.color, lane.id, lane.m1);
	} else {
		put(cells, lane.row, e, '╯', 'corner', lane.color, lane.id, lane.m1);
		if (e - s >= 3) put(cells, lane.row, e - 1, '●', 'commit', lane.color, lane.id, lane.m1);
	}
}

function drawConnectors(
	cells: GridCell[][],
	t: Timeline,
	l: LayoutResult,
	lane: Lane,
	byId: Map<string, Lane>
): void {
	const s = colForMonth(t, l, lane.m0);
	const e = colForMonth(t, l, lane.m1);

	if (lane.parent) {
		// A promoted lane connects from its parent's row, not from the trunk.
		const parent = byId.get(lane.parent);
		if (parent) vline(cells, s, parent.row, lane.row, parent.color, parent.id, lane.m0);
	} else {
		put(cells, TRUNK_ROW, s, '┬', 'fork', 'neutral', 'trunk', lane.m0);
		vline(cells, s, TRUNK_ROW, lane.row, lane.color, lane.id, lane.m0);
	}

	if (!lane.head && !lane.into) {
		put(cells, TRUNK_ROW, e, '┴', 'fork', 'neutral', 'trunk', lane.m1);
		vline(cells, e, TRUNK_ROW, lane.row, lane.color, lane.id, lane.m1);
	}
}

/** Flattens a `Grid` into one text line per row (for snapshot-style tests). */
export function gridToText(grid: Grid): string {
	return grid.cells
		.map((row) =>
			row
				.map((cell) => cell.chs)
				.join('')
				.trimEnd()
		)
		.join('\n');
}
