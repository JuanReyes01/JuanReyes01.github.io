import { monthLabel } from './month';
import type { Timeline } from './types';

/**
 * Builds the sr-only paragraph the timeline canvas points to via
 * `aria-describedby` (design D16): a text equivalent of what the visual
 * grid shows, so canvas content has an accessible parity text (spec
 * "Canvas text parity").
 */
export function describeTimeline(t: Timeline): string {
	const parts = t.lanes.map((lane) => {
		const end = lane.head ? 'present' : monthLabel(lane.m1);
		return `${lane.label}, ${monthLabel(lane.m0)} to ${end}`;
	});
	return `Career timeline from ${monthLabel(t.epoch)} to ${monthLabel(t.last)}: ${parts.join('; ')}.`;
}
