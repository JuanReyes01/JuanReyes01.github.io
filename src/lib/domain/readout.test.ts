import { describe, it, expect } from 'vitest';
import { readoutAt } from './readout';
import { deriveTimeline } from './timeline';
import { parseMonth } from './month';
import type { TimelineInput } from './types';

const m = parseMonth;
const ENTRIES: TimelineInput[] = [
	{
		id: 'ml',
		start: m('2025-05'),
		end: m('2026-02'),
		lane: { label: 'Machine Learning Engineer', short: 'ml eng', color: 'yellow' },
		events: [{ at: m('2025-05'), text: 'Machine Learning Engineer — Creceré' }]
	},
	{
		id: 'caio',
		start: m('2026-02'),
		end: 'present',
		promotedFrom: 'ml',
		lane: { label: 'Chief AI Officer', short: 'chief ai', color: 'pink' },
		events: [{ at: m('2026-02'), text: 'Promoted to Chief AI Officer — Creceré' }]
	}
];
const timeline = deriveTimeline(ENTRIES, m('2026-09'));

describe('readoutAt', () => {
	it('reports the active lane and its most recent event at the current head (matches the legacy readout)', () => {
		const r = readoutAt(timeline, m('2026-09'));
		expect(r).toEqual({
			date: '2026-09',
			laneId: 'caio',
			text: 'Promoted to Chief AI Officer — Creceré'
		});
	});

	it('reports the earlier lane and event for a month before the promotion', () => {
		const r = readoutAt(timeline, m('2025-08'));
		expect(r).toEqual({
			date: '2025-08',
			laneId: 'ml',
			text: 'Machine Learning Engineer — Creceré'
		});
	});

	it('returns null when the month falls before the timeline epoch', () => {
		expect(readoutAt(timeline, m('2019-01'))).toBeNull();
	});
});
