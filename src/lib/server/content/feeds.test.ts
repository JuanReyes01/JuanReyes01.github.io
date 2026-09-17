import { describe, it, expect } from 'vitest';
import { buildRss, buildSitemap, postsToFeedItems } from './feeds';
import type { ContentEntry } from './collections';
import type { PostFrontmatter } from './schemas';

const SITE = 'https://jreyes.dev';

function post(
	data: Partial<PostFrontmatter> & { title: string },
	slug: string
): ContentEntry<PostFrontmatter> {
	return {
		slug,
		html: '<p>body</p>',
		data: {
			title: data.title,
			date: data.date ?? '2026-01-01',
			summary: data.summary ?? 'summary',
			tags: data.tags ?? [],
			draft: data.draft ?? false
		}
	};
}

describe('postsToFeedItems', () => {
	it('excludes drafts', () => {
		const items = postsToFeedItems(
			[post({ title: 'Published' }, 'a'), post({ title: 'Draft', draft: true }, 'b')],
			SITE
		);
		expect(items.map((i) => i.title)).toEqual(['Published']);
	});

	it('links each item under /writing/<slug>/', () => {
		const items = postsToFeedItems([post({ title: 'X' }, 'x-slug')], SITE);
		expect(items[0].link).toBe('https://jreyes.dev/writing/x-slug/');
	});
});

describe('buildRss', () => {
	it('escapes XML-special characters in the title', () => {
		const xml = buildRss(SITE, [
			{ title: 'A & B <C>', link: `${SITE}/writing/a/`, description: 'd', pubDate: 'now' }
		]);
		expect(xml).toContain('A &amp; B &lt;C&gt;');
		expect(xml).not.toContain('<title>A & B <C></title>');
	});

	it('produces one <item> per feed entry', () => {
		const xml = buildRss(SITE, [
			{ title: 'One', link: 'l1', description: 'd', pubDate: 'now' },
			{ title: 'Two', link: 'l2', description: 'd', pubDate: 'now' }
		]);
		expect(xml.match(/<item>/g)).toHaveLength(2);
	});
});

describe('buildSitemap', () => {
	it('produces one <url> per entry with an absolute <loc>', () => {
		const xml = buildSitemap(SITE, [{ loc: '/' }, { loc: '/work/' }]);
		expect(xml).toContain(`<loc>${SITE}/</loc>`);
		expect(xml).toContain(`<loc>${SITE}/work/</loc>`);
		expect(xml.match(/<url>/g)).toHaveLength(2);
	});
});
