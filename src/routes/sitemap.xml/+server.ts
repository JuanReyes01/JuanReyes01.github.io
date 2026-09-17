import { SITE_URL } from '$lib/site';
import { postEntries, workEntries } from '$lib/server/content/collections';
import { buildSitemap, sitemapRoutes } from '$lib/server/content/feeds';
import type { RequestHandler } from './$types';

export const prerender = true;
export const trailingSlash = 'never';

export const GET: RequestHandler = () => {
	const workSlugs = workEntries().map((entry) => entry.slug);
	const routes = sitemapRoutes(workSlugs, postEntries());
	return new Response(
		buildSitemap(
			SITE_URL,
			routes.map((loc) => ({ loc }))
		),
		{ headers: { 'Content-Type': 'application/xml' } }
	);
};
