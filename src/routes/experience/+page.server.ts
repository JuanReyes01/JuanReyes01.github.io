import { experienceEntries, sortExperienceForDisplay } from '$lib/server/content/collections';
import { parseMonth } from '$lib/domain/month';
import type { TimelineInput } from '$lib/domain/types';
import type { PageServerLoad } from './$types';

// Timeline canvas hydrates here (design route table: `/experience/` → csr on).
export const csr = true;

export const load: PageServerLoad = () => {
	const entries = experienceEntries();

	const timelineInputs: TimelineInput[] = entries.map((entry) => ({
		id: entry.data.id,
		start: parseMonth(entry.data.start),
		end: entry.data.end === 'present' ? 'present' : parseMonth(entry.data.end),
		lane: entry.data.lane,
		promotedFrom: entry.data.promotedFrom,
		events: entry.data.events.map((event) => ({ at: parseMonth(event.at), text: event.text }))
	}));

	const roles = sortExperienceForDisplay(entries).map((entry) => ({
		id: entry.data.id,
		title: entry.data.title,
		org: entry.data.org,
		summary: entry.data.summary,
		start: entry.data.start,
		end: entry.data.end,
		bodyHtml: entry.html
	}));

	return { timelineInputs, roles };
};
