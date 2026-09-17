import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

describe('/experience/ redirect stub (v2 direction slice S1: merged into /work/)', () => {
	it('sets a meta refresh to /work/', () => {
		const { head } = render(Page);
		expect(head).toContain('http-equiv="refresh"');
		expect(head).toContain('url=/work/');
	});

	it('embeds an inline script that calls location.replace with /work/', () => {
		const { head } = render(Page);
		expect(head).toMatch(/<script>location\.replace\(['"]\/work\/['"]\);<\/script>/);
	});

	it('renders a visible fallback link to /work/ for anyone whose script/refresh does not fire', () => {
		const { body } = render(Page);
		expect(body).toMatch(/<a[^>]*href="\/work\/"/);
	});

	it('has a single h1, for a11y and page-outline consistency with every other route', () => {
		const { body } = render(Page);
		expect(body.match(/<h1[ >]/g)).toHaveLength(1);
	});

	it('is marked noindex — it is a courtesy redirect, not a page worth indexing', () => {
		const { head } = render(Page);
		expect(head).toContain('name="robots" content="noindex"');
	});
});
