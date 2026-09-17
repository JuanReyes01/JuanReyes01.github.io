import { error } from '@sveltejs/kit';
import { workEntries } from '$lib/server/content/collections';
import type { EntryGenerator, PageServerLoad } from './$types';

// No canvas on this route (design route table: `/work/[slug]/` → csr off).
export const csr = false;

export const entries: EntryGenerator = () => {
	return workEntries().map((entry) => ({ slug: entry.slug }));
};

export const load: PageServerLoad = ({ params }) => {
	const entry = workEntries().find((e) => e.slug === params.slug);
	if (!entry) error(404, 'Not found');

	return {
		slug: entry.slug,
		bodyHtml: entry.html,
		...entry.data
	};
};
