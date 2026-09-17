import { describe, it, expect } from 'vitest';
import { deriveTimeline } from './timeline';
import { parseMonth } from './month';
import type { TimelineInput } from './types';

const m = parseMonth;

/** Mirrors the real 5-entry `content/experience/*.md` fixture (task 3.4). */
const REAL_ENTRIES: TimelineInput[] = [
	{
		id: 'bs',
		start: m('2019-08'),
		end: m('2025-10'),
		lane: { label: 'B.S. Electronics + Systems Eng.', short: 'b.s. ×2', color: 'green' },
		events: [{ at: m('2025-10'), text: 'Graduated with two B.S. degrees, GPA 4.16/5.0' }]
	},
	{
		id: 'cornell',
		start: m('2024-06'),
		end: m('2024-08'),
		lane: { label: 'Research Intern', short: 'research · cornell', color: 'blue' },
		events: [{ at: m('2024-06'), text: 'Research Intern — Cornell University' }]
	},
	{
		id: 'ra',
		start: m('2024-09'),
		end: m('2025-12'),
		lane: { label: 'Research Assistant', short: 'research · uniandes', color: 'magenta' },
		events: [{ at: m('2024-09'), text: 'Research Assistant — Universidad de los Andes' }]
	},
	{
		id: 'ml',
		start: m('2025-05'),
		end: m('2026-02'),
		lane: { label: 'Machine Learning Engineer', short: 'ml eng · creceré', color: 'yellow' },
		events: [{ at: m('2025-05'), text: 'Machine Learning Engineer — Creceré' }]
	},
	{
		id: 'caio',
		start: m('2026-02'),
		end: 'present',
		promotedFrom: 'ml',
		lane: { label: 'Chief AI Officer', short: 'chief ai · creceré', color: 'pink' },
		events: [{ at: m('2026-02'), text: 'Promoted to Chief AI Officer — Creceré' }]
	}
];

describe('deriveTimeline', () => {
	it('places each of the 5 lanes on its own odd row starting at 4, sorted by start', () => {
		const t = deriveTimeline(REAL_ENTRIES, m('2026-09'));
		expect(t.lanes.map((l) => l.id)).toEqual(['bs', 'cornell', 'ra', 'ml', 'caio']);
		expect(t.lanes.map((l) => l.row)).toEqual([4, 6, 8, 10, 12]);
	});

	it('sets epoch to the earliest start month across all entries', () => {
		const t = deriveTimeline(REAL_ENTRIES, m('2026-09'));
		expect(t.epoch).toBe(m('2019-08'));
	});

	it('links a promotion: the parent lane gets `into`, the child gets `parent`', () => {
		const t = deriveTimeline(REAL_ENTRIES, m('2026-09'));
		const ml = t.lanes.find((l) => l.id === 'ml');
		const caio = t.lanes.find((l) => l.id === 'caio');
		expect(ml?.into).toBe('caio');
		expect(caio?.parent).toBe('ml');
	});

	it('marks only the open-ended ("present") lane as head, ending at `last`', () => {
		const t = deriveTimeline(REAL_ENTRIES, m('2026-09'));
		const caio = t.lanes.find((l) => l.id === 'caio')!;
		expect(caio.head).toBe(true);
		expect(caio.m1).toBe(t.last);
		expect(t.lanes.filter((l) => l.head)).toHaveLength(1);
	});

	it('sets `last` to `today` when today is later than the latest content month', () => {
		const t = deriveTimeline(REAL_ENTRIES, m('2026-09'));
		expect(t.last).toBe(m('2026-09'));
	});

	it('sets `last` to the latest content month when today is earlier than it', () => {
		const t = deriveTimeline(REAL_ENTRIES, m('2020-01'));
		expect(t.last).toBe(m('2026-02'));
	});

	it('carries every entry event into the flat, dated event list', () => {
		const t = deriveTimeline(REAL_ENTRIES, m('2026-09'));
		expect(t.events).toHaveLength(5);
		expect(t.events).toContainEqual({
			m: m('2026-02'),
			lane: 'caio',
			text: 'Promoted to Chief AI Officer — Creceré'
		});
	});
});
