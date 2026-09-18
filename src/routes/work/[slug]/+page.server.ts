import { error } from '@sveltejs/kit';
import { workEntries } from '$lib/server/content/collections';
import type { EntryGenerator, PageServerLoad } from './$types';

// Owner complaint: "cuando voy a los builds individuales la animación ascii
// muere" — this route now hydrates its own live waveform header canvas
// (same engine as `/work/`, locked to this build's own signature), so `csr`
// is no longer forced off (design route table superseded; `/experience/`
// and `/404` are the zero-JS routes now — see `scripts/verify-build.ts`).

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
