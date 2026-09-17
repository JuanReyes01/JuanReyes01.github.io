import { formatMonth } from './month';
import type { Month, Timeline, TimelineDatedEvent } from './types';

export interface Readout {
	date: string;
	laneId: string | null;
	text: string;
	chips: string[];
}

function latestEventAt(events: TimelineDatedEvent[], month: Month): TimelineDatedEvent | null {
	let latest: TimelineDatedEvent | null = null;
	for (const event of events) {
		if (event.m <= month && (!latest || event.m > latest.m)) latest = event;
	}
	return latest;
}

/**
 * The `.tl-readout` line for a given scrub position, matching the legacy
 * `Timeline.prototype.updateReadout`: the LATEST event at or before `month`
 * (across every lane, not just the lane whose range contains `month`)
 * drives both the displayed text and the date's lane color, while `chips`
 * lists every lane active that month independent of which event is latest.
 */
export function readoutAt(t: Timeline, month: Month): Readout {
	const latest = latestEventAt(t.events, month);
	const chips = t.lanes
		.filter((lane) => lane.m0 <= month && month <= lane.m1)
		.map((lane) => lane.id);

	return {
		date: formatMonth(month),
		laneId: latest?.lane ?? null,
		text: latest?.text ?? '',
		chips
	};
}
