import { homePage, workEntries } from '$lib/server/content/collections';
import type { PageServerLoad } from './$types';

// Sky canvas hydrates here (design route table: `/` → csr on, sky engine).
export const csr = true;

export const load: PageServerLoad = () => {
	const home = homePage();
	const workBySlug = new Map(workEntries().map((entry) => [entry.slug, entry]));

	const highlights = home.data.highlights
		.map((slug) => workBySlug.get(slug))
		.filter((entry) => entry !== undefined)
		.map((entry) => ({
			slug: entry.slug,
			build: entry.data.build,
			title: entry.data.title,
			summary: entry.data.summary,
			metric: entry.data.metric
		}));

	return {
		bioHtml: home.html,
		now: home.data.now,
		how: home.data.how,
		highlights
	};
};
