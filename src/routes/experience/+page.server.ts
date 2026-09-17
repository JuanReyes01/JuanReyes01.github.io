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
		// F5 (sveltekit-migration apply-fix batch): prefer the content's own
		// `sub` line (legacy row sub-line, e.g. "creceré · ai debt-recovery
		// startup · 20 → 600 calls/min") — falls back to the org name for
		// any entry that hasn't set one.
		sub: entry.data.sub ?? entry.data.org.toLowerCase(),
		summary: entry.data.summary,
		start: entry.data.start,
		end: entry.data.end,
		bodyHtml: entry.html
	}));

	return { timelineInputs, roles };
};
