import { describe, it, expect } from 'vitest';
import { layoutFor } from './layout';
import { deriveTimeline } from './timeline';
import { parseMonth } from './month';
import type { TimelineInput } from './types';

const m = parseMonth;
const ENTRIES: TimelineInput[] = [
	{
		id: 'bs',
		start: m('2019-08'),
		end: m('2025-10'),
		lane: { label: 'B.S. Electronics + Systems Eng.', short: 'b.s. ×2', color: 'green' },
		events: [{ at: m('2019-08'), text: 'Started' }]
	},
	{
		id: 'caio',
		start: m('2026-02'),
		end: 'present',
		lane: { label: 'Chief AI Officer', short: 'chief ai', color: 'pink' },
		events: [{ at: m('2026-02'), text: 'Promoted' }]
	}
];
const timeline = deriveTimeline(ENTRIES, m('2026-09'));

describe('layoutFor', () => {
	it('sizes the label column from the longest lane label plus 2', () => {
		const l = layoutFor(1200, timeline);
		expect(l.lab).toBe('B.S. Electronics + Systems Eng.'.length + 2);
	});

	it('rows follow `3 + 2n` for n lanes', () => {
		const l = layoutFor(1200, timeline);
		expect(l.rows).toBe(3 + 2 * timeline.lanes.length);
	});

	it('uses step 1 (every month) when the viewport is wide enough', () => {
		const l = layoutFor(2000, timeline);
		expect(l.step).toBe(1);
	});

	it('falls back to step 2 (every other month) on a narrow viewport', () => {
		const l = layoutFor(320, timeline);
		expect(l.step).toBe(2);
	});

	it('cols always covers the full epoch..last span at the chosen step', () => {
		const totalMonths = timeline.last - timeline.epoch + 1;
		const narrow = layoutFor(320, timeline);
		expect(narrow.cols).toBe(Math.ceil(totalMonths / narrow.step));
	});
});
