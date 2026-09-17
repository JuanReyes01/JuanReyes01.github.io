import type { ContentEntry } from './collections';
import type { PostFrontmatter } from './schemas';

export interface FeedItem {
	title: string;
	link: string;
	description: string;
	pubDate: string;
}

export interface SitemapUrl {
	loc: string;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** Published (non-draft) posts as feed items (spec "Feed and sitemap coverage"). */
export function postsToFeedItems(
	posts: ContentEntry<PostFrontmatter>[],
	siteUrl: string
): FeedItem[] {
	return posts
		.filter((p) => !p.data.draft)
		.map((p) => ({
			title: p.data.title,
			link: `${siteUrl}/writing/${p.slug}/`,
			description: p.data.summary,
			pubDate: new Date(`${p.data.date}T00:00:00Z`).toUTCString()
		}));
}

export function buildRss(siteUrl: string, items: FeedItem[]): string {
	const entries = items
		.map(
			(i) =>
				`<item><title>${escapeXml(i.title)}</title><link>${escapeXml(i.link)}</link>` +
				`<description>${escapeXml(i.description)}</description><pubDate>${escapeXml(i.pubDate)}</pubDate></item>`
		)
		.join('');
	return (
		`<?xml version="1.0" encoding="UTF-8"?>` +
		`<rss version="2.0"><channel><title>Juan Camilo Reyes</title>` +
		`<link>${escapeXml(siteUrl)}</link>${entries}</channel></rss>`
	);
}

export function buildSitemap(siteUrl: string, urls: SitemapUrl[]): string {
	const entries = urls.map((u) => `<url><loc>${escapeXml(siteUrl + u.loc)}</loc></url>`).join('');
	return (
		`<?xml version="1.0" encoding="UTF-8"?>` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`
	);
}
