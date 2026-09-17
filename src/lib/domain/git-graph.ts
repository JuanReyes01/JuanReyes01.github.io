import type { Grid, GridCell, Lane, LayoutResult, Timeline } from './types';

function emptyCell(): GridCell {
	return { chs: ' ', kind: 'empty' };
}

function colForMonth(t: Timeline, l: LayoutResult, month: number): number {
	return Math.round((month - t.epoch) / l.step);
}

/**
 * Renders the timeline as a git-graph-style grid: one row per lane, a `●`
 * node at its start, a run of `─` to its end, an open `◉` head node for the
 * lane still in progress, and a `╮` link one row below a promoted lane
 * (design D4: `ml.into = caio`, drawn in the parent's row + 1).
 */
export function buildGrid(t: Timeline, l: LayoutResult): Grid {
	const cells: GridCell[][] = Array.from({ length: l.rows }, () =>
		Array.from({ length: l.cols }, emptyCell)
	);

	const byId = new Map<string, Lane>(t.lanes.map((lane) => [lane.id, lane]));

	for (const lane of t.lanes) {
		const c0 = colForMonth(t, l, lane.m0);
		const c1 = colForMonth(t, l, lane.m1);
		const row = cells[lane.row];
		for (let c = c0; c <= c1; c++) {
			const isStart = c === c0;
			const isHeadEnd = lane.head && c === c1;
			row[c] = {
				chs: isStart ? '●' : isHeadEnd ? '◉' : '─',
				kind: isStart || isHeadEnd ? 'node' : 'lane',
				color: lane.color,
				lane: lane.id,
				mon: t.epoch + c * l.step
			};
		}

		if (lane.into) {
			const child = byId.get(lane.into);
			if (child) {
				const linkRow = cells[lane.row + 1];
				if (linkRow) {
					linkRow[c1] = { chs: '╮', kind: 'link', color: lane.color, lane: lane.id };
				}
			}
		}
	}

	return { rows: l.rows, cols: l.cols, cells };
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
