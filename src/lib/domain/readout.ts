import { formatMonth } from './month';
import type { Month, Timeline } from './types';

export interface Readout {
	date: string;
	laneId: string;
	text: string;
}

/**
 * The `.tl-readout` line for a given scrub position: the active lane at
 * `month` and the text of its most recent event at or before that month.
 */
export function readoutAt(t: Timeline, month: Month): Readout | null {
	const lane = t.lanes.find((l) => month >= l.m0 && month <= l.m1);
	if (!lane) return null;

	const laneEvents = t.events
		.filter((e) => e.lane === lane.id && e.m <= month)
		.sort((a, b) => b.m - a.m);

	return {
		date: formatMonth(month),
		laneId: lane.id,
		text: laneEvents[0]?.text ?? lane.label
	};
}
