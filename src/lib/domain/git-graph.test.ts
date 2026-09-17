import { describe, it, expect } from 'vitest';
import { buildGrid, gridToText } from './git-graph';
import { deriveTimeline } from './timeline';
import { layoutFor } from './layout';
import { parseMonth } from './month';
import type { TimelineInput } from './types';

const m = parseMonth;
const ENTRIES: TimelineInput[] = [
	{
		id: 'ml',
		start: m('2025-05'),
		end: m('2026-02'),
		lane: { label: 'ML Engineer', short: 'ml', color: 'yellow' },
		events: [{ at: m('2025-05'), text: 'Started' }]
	},
	{
		id: 'caio',
		start: m('2026-02'),
		end: 'present',
		promotedFrom: 'ml',
		lane: { label: 'Chief AI Officer', short: 'caio', color: 'pink' },
		events: [{ at: m('2026-02'), text: 'Promoted' }]
	}
];

describe('buildGrid + gridToText', () => {
	it('draws each lane as a run of cells on its own row, from a start node to its end', () => {
		const t = deriveTimeline(ENTRIES, m('2026-09'));
		const l = layoutFor(2000, t);
		const grid = buildGrid(t, l);
		const mlRow = grid.cells[t.lanes[0].row];
		const firstFilled = mlRow.findIndex((c) => c.kind !== 'empty');
		expect(mlRow[firstFilled].chs).toBe('●');
		expect(mlRow[firstFilled].lane).toBe('ml');
		expect(mlRow.some((c) => c.kind === 'lane' && c.lane === 'ml')).toBe(true);
	});

	it("marks the open-ended head lane's last filled cell as the head node", () => {
		const t = deriveTimeline(ENTRIES, m('2026-09'));
		const l = layoutFor(2000, t);
		const grid = buildGrid(t, l);
		const caioRow = grid.cells[t.lanes[1].row];
		const filled = caioRow.filter((c) => c.kind !== 'empty');
		expect(filled[filled.length - 1].chs).toBe('◉');
	});

	it('draws a promotion link between a parent lane and its child one row below', () => {
		const t = deriveTimeline(ENTRIES, m('2026-09'));
		const l = layoutFor(2000, t);
		const grid = buildGrid(t, l);
		const ml = t.lanes.find((lane) => lane.id === 'ml')!;
		const linkRow = grid.cells[ml.row + 1];
		expect(linkRow.some((c) => c.kind === 'link' && c.chs === '╮')).toBe(true);
	});

	it('gridToText renders one text line per row with no trailing whitespace', () => {
		const t = deriveTimeline(ENTRIES, m('2026-09'));
		const l = layoutFor(2000, t);
		const text = gridToText(buildGrid(t, l));
		const lines = text.split('\n');
		expect(lines).toHaveLength(l.rows);
		for (const line of lines) expect(line).toBe(line.trimEnd());
	});

	it('narrow layouts (step 2) still render a grid with the correct row/col count', () => {
		const t = deriveTimeline(ENTRIES, m('2026-09'));
		const l = layoutFor(300, t);
		const grid = buildGrid(t, l);
		expect(grid.rows).toBe(l.rows);
		expect(grid.cols).toBe(l.cols);
		expect(grid.cells[t.lanes[0].row].some((c) => c.kind !== 'empty')).toBe(true);
	});
});
