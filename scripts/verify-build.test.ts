import { describe, it, expect } from 'vitest';
import {
	checkCname,
	checkRequiredFiles,
	sitemapLocPaths,
	checkSitemapUrlsHaveFiles,
	hasClientBundle,
	checkNoClientBundle,
	zeroJsHtmlPaths
} from './verify-build';

describe('checkCname', () => {
	it('passes for the exact expected domain', () => {
		expect(checkCname('jreyes.dev')).toEqual([]);
	});

	it('tolerates a trailing newline', () => {
		expect(checkCname('jreyes.dev\n')).toEqual([]);
	});

	it('fails when the content is wrong', () => {
		expect(checkCname('example.com')).toHaveLength(1);
	});

	it('fails when the file is missing', () => {
		expect(checkCname(undefined)).toHaveLength(1);
	});
});

describe('checkRequiredFiles', () => {
	it('reports every missing required file', () => {
		const issues = checkRequiredFiles((path) => path === '404.html');
		expect(issues.map((i) => i.message)).toEqual([
			'missing build/.nojekyll',
			'missing build/rss.xml',
			'missing build/sitemap.xml'
		]);
	});

	it('reports nothing when every required file exists', () => {
		expect(checkRequiredFiles(() => true)).toEqual([]);
	});
});

describe('sitemapLocPaths', () => {
	it('strips the site origin from every <loc>', () => {
		const xml =
			'<urlset><url><loc>https://jreyes.dev/</loc></url><url><loc>https://jreyes.dev/work/creditbay/</loc></url></urlset>';
		expect(sitemapLocPaths(xml, 'https://jreyes.dev')).toEqual(['/', '/work/creditbay/']);
	});
});

describe('checkSitemapUrlsHaveFiles', () => {
	it('reports a sitemap URL with no matching index.html', () => {
		const issues = checkSitemapUrlsHaveFiles(['/', '/work/ghost/'], (p) => p === '/index.html');
		expect(issues).toHaveLength(1);
		expect(issues[0].message).toContain('/work/ghost/');
	});

	it('reports nothing when every sitemap URL has a file', () => {
		expect(checkSitemapUrlsHaveFiles(['/', '/work/'], () => true)).toEqual([]);
	});
});

describe('hasClientBundle', () => {
	it('detects a modulepreload hydration hint', () => {
		expect(hasClientBundle('<link href="/_app/x.js" rel="modulepreload">')).toBe(true);
	});

	it('does not flag the always-present inline clock script (design D5)', () => {
		const html = '<script>document.querySelector("[data-clock]")</script>';
		expect(hasClientBundle(html)).toBe(false);
	});

	it('does not flag component-scoped CSS served from the same _app/immutable path (false-positive guard)', () => {
		// Discovered against a real build: csr:false routes still link their
		// component CSS from `_app/immutable/assets/*.css` — that's not JS.
		const html = '<link href="/_app/immutable/assets/Row.abc123.css" rel="stylesheet">';
		expect(hasClientBundle(html)).toBe(false);
	});
});

describe('zeroJsHtmlPaths', () => {
	it('scans only experience and 404 — /work/[slug]/ now ships its own live per-build waveform header', () => {
		const listHtml = (dir: string) =>
			dir === 'experience' ? ['experience/index.html'] : ['SHOULD NOT APPEAR'];
		expect(zeroJsHtmlPaths(listHtml)).toEqual(['experience/index.html', '404.html']);
	});

	it('never asks for the work or writing directories', () => {
		const requestedDirs: string[] = [];
		zeroJsHtmlPaths((dir) => {
			requestedDirs.push(dir);
			return [];
		});
		expect(requestedDirs).toEqual(['experience']);
	});
});

describe('checkNoClientBundle', () => {
	it('flags a zero-JS route that actually ships a bundle', () => {
		const issues = checkNoClientBundle([
			{ path: 'work/index.html', html: '<link rel="modulepreload" href="/x.js">' }
		]);
		expect(issues).toHaveLength(1);
		expect(issues[0].message).toContain('work/index.html');
	});

	it('passes a zero-JS route that only has the inline clock script', () => {
		const issues = checkNoClientBundle([
			{ path: '404.html', html: '<script>/* clock */</script>' }
		]);
		expect(issues).toEqual([]);
	});
});
