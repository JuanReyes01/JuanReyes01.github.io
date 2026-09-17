import { fieldPage } from '$lib/server/content/collections';
import type { PageServerLoad } from './$types';

// Band canvas hydrates here (design route table: `/field/` → csr on).
export const csr = true;

export const load: PageServerLoad = () => {
	const page = fieldPage();
	return {
		bodyHtml: page.html,
		diagram: page.data.diagram,
		stations: page.data.stations
	};
};
