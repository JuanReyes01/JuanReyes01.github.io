import { SITE_URL } from '$lib/site';
import { postEntries } from '$lib/server/content/collections';
import { buildRss, postsToFeedItems } from '$lib/server/content/feeds';
import type { RequestHandler } from './$types';

export const prerender = true;
export const trailingSlash = 'never';

export const GET: RequestHandler = () => {
	const items = postsToFeedItems(postEntries(), SITE_URL);
	return new Response(buildRss(SITE_URL, items), {
		headers: { 'Content-Type': 'application/xml' }
	});
};
