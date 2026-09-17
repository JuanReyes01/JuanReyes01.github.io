import { formatMonth } from './month';
import type { Lane, Month, Timeline, TimelineDatedEvent, TimelineInput } from './types';

/**
 * Derives the career timeline from content-sourced entries (design D4).
 * Lanes are sorted by start ascending and packed on odd rows starting at 4
 * (`row = 4 + 2i`), so nothing here is hand-maintained — adding a role is
 * one markdown file (spec "Derived timeline").
 */
export function deriveTimeline(entries: TimelineInput[], today: Month): Timeline {
	for (const entry of entries) {
		const end = entry.end === 'present' ? Infinity : entry.end;
		if (entry.start > end) {
			throw new Error(
				`invalid timeline entry "${entry.id}": start (${formatMonth(entry.start)}) is after end (${formatMonth(entry.end as Month)})`
			);
		}
	}

	const sorted = [...entries].sort((a, b) => a.start - b.start);
	const epoch = sorted.length ? sorted[0].start : today;

	const latestContentMonth = sorted.reduce((max, e) => {
		const end = e.end === 'present' ? e.start : e.end;
		return Math.max(max, end);
	}, epoch);
	const last = Math.max(latestContentMonth, today);

	const lanes: Lane[] = sorted.map((entry, i) => ({
		id: entry.id,
		label: entry.lane.label,
		short: entry.lane.short,
		color: entry.lane.color,
		m0: entry.start,
		m1: entry.end === 'present' ? last : entry.end,
		row: 4 + 2 * i,
		head: entry.end === 'present'
	}));

	const byId = new Map(lanes.map((l) => [l.id, l]));
	for (const entry of sorted) {
		if (!entry.promotedFrom) continue;
		const parent = byId.get(entry.promotedFrom);
		const child = byId.get(entry.id);
		if (!parent || !child) continue;
		parent.into = child.id;
		child.parent = parent.id;
	}

	const events: TimelineDatedEvent[] = sorted.flatMap((entry) =>
		entry.events.map((e) => ({ m: e.at, lane: entry.id, text: e.text }))
	);

	return { epoch, last, lanes, events };
}
