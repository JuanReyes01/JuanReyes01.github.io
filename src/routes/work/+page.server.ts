import {
	experienceEntries,
	sortExperienceForDisplay,
	workEntries,
	sortWorkForDisplay
} from '$lib/server/content/collections';
import { parseMonth } from '$lib/domain/month';
import type { TimelineInput } from '$lib/domain/types';
import type { PageServerLoad } from './$types';

// The career timeline canvas hydrates here now — v2 direction slice S1
// merged `/experience/` into `/work/`, so the timeline graph is the index
// of the whole page. `/work/[slug]/` hydrates too now (its own live
// per-build waveform header), so `/experience/` and `/404` are the only
// zero-JS routes left (see `scripts/verify-build.ts`).
export const csr = true;

export const load: PageServerLoad = () => {
	const experience = experienceEntries();

	const timelineInputs: TimelineInput[] = experience.map((entry) => ({
		id: entry.data.id,
		start: parseMonth(entry.data.start),
		end: entry.data.end === 'present' ? 'present' : parseMonth(entry.data.end),
		lane: entry.data.lane,
		promotedFrom: entry.data.promotedFrom,
		events: entry.data.events.map((event) => ({ at: parseMonth(event.at), text: event.text }))
	}));

	const roles = sortExperienceForDisplay(experience).map((entry) => ({
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

	const builds = sortWorkForDisplay(workEntries()).map((entry) => ({
		slug: entry.slug,
		build: entry.data.build,
		title: entry.data.title,
		summary: entry.data.summary,
		stack: entry.data.stack,
		metric: entry.data.metric,
		// v2 direction slice S1: the experience id whose career period this
		// build belongs to, for timeline lane <-> build cross-highlighting.
		lane: entry.data.lane ?? null
	}));

	return { timelineInputs, roles, builds };
};
