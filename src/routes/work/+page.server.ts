import { workEntries, sortWorkForDisplay } from '$lib/server/content/collections';
import type { PageServerLoad } from './$types';

// No canvas on this route (design route table: `/work/` → csr off).
export const csr = false;

export const load: PageServerLoad = () => {
	const builds = sortWorkForDisplay(workEntries()).map((entry) => ({
		slug: entry.slug,
		build: entry.data.build,
		title: entry.data.title,
		summary: entry.data.summary,
		stack: entry.data.stack,
		metric: entry.data.metric
	}));
	return { builds };
};
