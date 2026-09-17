import { describe, it, expect } from 'vitest';
import { buildGrid, gridToText } from './git-graph';
import { deriveTimeline } from './timeline';
import { layoutFor } from './layout';
import { parseMonth } from './month';
import { REAL_ENTRIES, TODAY } from './fixtures';

const m = parseMonth;

// Wide layout: step 1, one column per month. Columns derived from
// layoutFor's own formula (lab + floor((month-epoch)/step)) for the real
// 5-lane fixture, so these numbers move with the fixture, not against it.
const wideTimeline = deriveTimeline(REAL_ENTRIES, TODAY);
const wideLayout = layoutFor(2000, wideTimeline);
const wideGrid = buildGrid(wideTimeline, wideLayout);

function laneOf(id: string) {
	return wideTimeline.lanes.find((l) => l.id === id)!;
}

function colOf(month: number) {
	return wideLayout.lab + Math.floor((month - wideTimeline.epoch) / wideLayout.step);
}

describe('buildGrid — wide layout (step 1)', () => {
	it('draws the year axis as a line with a tick at the epoch month and at every January', () => {
		const axisRow = wideGrid.cells[1];
		for (let c = wideLayout.lab; c <= colOf(wideTimeline.last); c++) {
			expect(axisRow[c].kind === 'axis').toBe(true);
		}
		const epochTick = axisRow[colOf(wideTimeline.epoch)];
		expect(epochTick.chs).toBe('┬');
		const jan2024 = axisRow[colOf(m('2024-01'))];
		expect(jan2024.chs).toBe('┬');
		expect(jan2024.kind).toBe('axis');
	});

	it('writes non-colliding year labels on the row above the axis', () => {
		const labelRow = wideGrid.cells[0];
		const col2024 = colOf(m('2024-01'));
		expect(labelRow[col2024].chs).toBe('2');
		expect(labelRow[col2024 + 1].chs).toBe('0');
		expect(labelRow[col2024 + 2].chs).toBe('2');
		expect(labelRow[col2024 + 3].chs).toBe('4');
	});

	it('labels the trunk "main" and ends it with a HEAD commit at the last column', () => {
		const trunkRow = wideGrid.cells[2];
		expect(trunkRow[1].chs).toBe('m');
		expect(trunkRow[2].chs).toBe('a');
		expect(trunkRow[3].chs).toBe('i');
		expect(trunkRow[4].chs).toBe('n');
		const endC = colOf(wideTimeline.last);
		expect(trunkRow[endC]).toMatchObject({ chs: '●', kind: 'head' });
		expect(trunkRow[endC - 1].chs).toBe('─');

		const headLabelRow = wideGrid.cells[3];
		expect(headLabelRow[endC - 2].chs).toBe('H');
		expect(headLabelRow[endC - 1].chs).toBe('E');
		expect(headLabelRow[endC].chs).toBe('A');
		expect(headLabelRow[endC + 1].chs).toBe('D');
	});

	it('draws a merged lane (Research Assistant: no head, no promotion) with corner, commit dots and a heavy run', () => {
		const ra = laneOf('ra');
		const row = wideGrid.cells[ra.row];
		const s = colOf(ra.m0);
		const e = colOf(ra.m1);
		expect(row[s]).toMatchObject({ chs: '╰', kind: 'corner', lane: 'ra' });
		expect(row[s + 1]).toMatchObject({ chs: '●', kind: 'commit', lane: 'ra' });
		expect(row[s + 2]).toMatchObject({ chs: '━', kind: 'h', lane: 'ra' });
		expect(row[e - 1]).toMatchObject({ chs: '●', kind: 'commit', lane: 'ra' });
		expect(row[e]).toMatchObject({ chs: '╯', kind: 'corner', lane: 'ra' });
	});

	it('marks the open-ended head lane (CAIO) with a plain commit dot at its end, never a merge corner', () => {
		const caio = laneOf('caio');
		const row = wideGrid.cells[caio.row];
		const e = colOf(caio.m1);
		expect(row[e]).toMatchObject({ chs: '●', kind: 'commit', lane: 'caio' });
	});

	it('forks a non-promoted lane from the trunk with a ┬ mark and a plain vertical down to its row', () => {
		const bs = laneOf('bs');
		const s = colOf(bs.m0);
		expect(wideGrid.cells[2][s]).toMatchObject({ chs: '┬', kind: 'fork' });
		for (let r = 3; r < bs.row; r++) {
			expect(wideGrid.cells[r][s]).toMatchObject({ chs: '│', kind: 'v' });
		}
	});

	it('merges a fully-closed lane back into the trunk with a ┴ mark and a vertical down to its row', () => {
		const bs = laneOf('bs');
		const e = colOf(bs.m1);
		expect(wideGrid.cells[2][e]).toMatchObject({ chs: '┴', kind: 'fork' });
		expect(wideGrid.cells[3][e]).toMatchObject({ chs: '│', kind: 'v' });
	});

	it('does not fork the promoted child (CAIO) from the trunk — it connects from its parent instead', () => {
		const caio = laneOf('caio');
		const s = colOf(caio.m0);
		expect(wideGrid.cells[2][s].kind).not.toBe('fork');
	});

	it('draws the promotion link: a ╮ at the parent (ML) end column in the parent row, and a vertical down to the child (CAIO) row', () => {
		const ml = laneOf('ml');
		const caio = laneOf('caio');
		const linkCol = colOf(ml.m1);
		expect(linkCol).toBe(colOf(caio.m0));
		expect(wideGrid.cells[ml.row][linkCol]).toMatchObject({ chs: '╮', kind: 'corner', lane: 'ml' });
		for (let r = ml.row + 1; r < caio.row; r++) {
			expect(wideGrid.cells[r][linkCol]).toMatchObject({ kind: 'v', lane: 'ml' });
		}
		expect(wideGrid.cells[caio.row][linkCol]).toMatchObject({
			chs: '╰',
			kind: 'corner',
			lane: 'caio'
		});
	});

	it('crosses a vertical connector through an already-drawn lane cell with a ┼', () => {
		const bs = laneOf('bs');
		const ra = laneOf('ra');
		const crossCol = colOf(ra.m0);
		// Research Assistant starts while B.S. is still an open heavy run —
		// its trunk-to-lane vertical must cross bs's row.
		expect(wideGrid.cells[bs.row][crossCol]).toMatchObject({ chs: '┼', kind: 'v' });
	});

	it('gridToText renders one non-trailing-whitespace line per row, every row the same length as the layout', () => {
		expect(wideGrid.cells.every((row) => row.length === wideLayout.cols)).toBe(true);
		const lines = gridToText(wideGrid).split('\n');
		expect(lines).toHaveLength(wideLayout.rows);
		for (const line of lines) expect(line).toBe(line.trimEnd());
	});

	it('gridToText matches the verified golden render of the real 5-lane fixture (approval test)', () => {
		// Generated from this exact implementation and manually checked
		// against every targeted assertion above (axis, trunk/HEAD, corners,
		// commits, forks, merges, the promotion link, and every crossing)
		// before being locked in here as a regression guard.
		expect(gridToText(wideGrid)).toBe(
			[
				'                                      2019 2020        2021        2022        2023        2024        2025        2026',
				'                                      ┬────┬───────────┬───────────┬───────────┬───────────┬───────────┬───────────┬────────',
				' main                                 ┬─────────────────────────────────────────────────────────┬─┴┬───────┬────┴─┴────────●',
				'                                      │                                                         │ ││       │    │ │      HEAD',
				' B.S. Electronics + B.S. Systems Eng. ╰●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┼━┼┼━━━━━━━┼━━━●╯ │',
				'                                                                                                │ ││       │      │',
				' Research Intern                                                                                ╰●╯│       │      │',
				'                                                                                                   │       │      │',
				' Research Assistant                                                                                ╰●━━━━━━┼━━━━━●╯',
				'                                                                                                           │',
				' Machine Learning Engineer                                                                                 ╰●━━━━━━━╮',
				'                                                                                                                    │',
				' Chief AI Officer                                                                                                   ╰●━━━━━●'
			].join('\n')
		);
	});
});

describe('buildGrid — narrow layout (step 2, odd month span)', () => {
	// today = 2026-10 makes the epoch..last span 87 months: odd at step 2.
	const narrowTimeline = deriveTimeline(REAL_ENTRIES, m('2026-10'));
	const narrowLayout = layoutFor(320, narrowTimeline);
	const narrowGrid = buildGrid(narrowTimeline, narrowLayout);

	function narrowColOf(month: number) {
		return narrowLayout.lab + Math.floor((month - narrowTimeline.epoch) / narrowLayout.step);
	}

	it('really computes step 2 for this viewport (regression: a too-small fixture previously stayed at step 1)', () => {
		expect(narrowLayout.step).toBe(2);
		expect((narrowTimeline.last - narrowTimeline.epoch + 1) % 2).toBe(1);
	});

	it('every row has identical length and no month overflows past the grid', () => {
		expect(narrowGrid.cells.every((row) => row.length === narrowLayout.cols)).toBe(true);
		const endC = narrowColOf(narrowTimeline.last);
		expect(endC).toBeLessThan(narrowLayout.cols);
	});

	it('skips a colliding year label but keeps its tick mark (epoch year collides with the next January at step 2)', () => {
		const epochCol = narrowColOf(narrowTimeline.epoch);
		const nextJanCol = narrowColOf(m('2020-01'));
		expect(nextJanCol - epochCol).toBeLessThan(5);
		expect(narrowGrid.cells[1][epochCol].chs).toBe('┬');
		expect(narrowGrid.cells[0][epochCol].chs).not.toBe('2');
	});

	it('draws a short lane (span 1 at step 2) with no interior commit dots — just its start corner', () => {
		const cornell = narrowTimeline.lanes.find((l) => l.id === 'cornell')!;
		const s = narrowColOf(cornell.m0);
		const e = narrowColOf(cornell.m1);
		expect(e - s).toBe(1);
		expect(narrowGrid.cells[cornell.row][s]).toMatchObject({ chs: '╰', kind: 'corner' });
		// At this compression, Research Assistant's own trunk fork lands on
		// this exact column and row (its start coincides with Cornell's end),
		// so the closing corner becomes a crossing rather than a plain `╯`.
		const ra = narrowTimeline.lanes.find((l) => l.id === 'ra')!;
		expect(narrowColOf(ra.m0)).toBe(e);
		expect(narrowGrid.cells[cornell.row][e]).toMatchObject({ chs: '┼', kind: 'v' });
	});
});
