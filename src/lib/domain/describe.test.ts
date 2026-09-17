import { describe, it, expect } from 'vitest';
import { describeTimeline } from './describe';
import { deriveTimeline } from './timeline';
import { parseMonth } from './month';
import type { TimelineInput } from './types';

const m = parseMonth;
const ENTRIES: TimelineInput[] = [
	{
		id: 'bs',
		start: m('2019-08'),
		end: m('2025-10'),
		lane: { label: 'B.S. Electronics + Systems Eng.', short: 'b.s.', color: 'green' },
		events: [{ at: m('2019-08'), text: 'Started' }]
	},
	{
		id: 'caio',
		start: m('2026-02'),
		end: 'present',
		lane: { label: 'Chief AI Officer', short: 'caio', color: 'pink' },
		events: [{ at: m('2026-02'), text: 'Promoted' }]
	}
];

describe('describeTimeline', () => {
	it('states the full epoch..last range and every lane with its date span', () => {
		const t = deriveTimeline(ENTRIES, m('2026-09'));
		expect(describeTimeline(t)).toBe(
			'Career timeline from Aug 2019 to Sep 2026: ' +
				'B.S. Electronics + Systems Eng., Aug 2019 to Oct 2025; ' +
				'Chief AI Officer, Feb 2026 to present.'
		);
	});

	it('reflects a narrower range with a different `today`', () => {
		const t = deriveTimeline(ENTRIES.slice(0, 1), m('2020-01'));
		expect(describeTimeline(t)).toBe(
			'Career timeline from Aug 2019 to Oct 2025: B.S. Electronics + Systems Eng., Aug 2019 to Oct 2025.'
		);
	});
});
