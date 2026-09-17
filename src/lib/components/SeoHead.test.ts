import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import SeoHead from './SeoHead.svelte';

describe('SeoHead', () => {
	it('renders title, description and an absolute canonical link', () => {
		const { head } = render(SeoHead, {
			props: { title: 'Home — Juan Camilo Reyes', description: 'Bio.', path: '/' }
		});
		expect(head).toContain('<title>Home — Juan Camilo Reyes</title>');
		expect(head).toContain('name="description" content="Bio."');
		expect(head).toContain('rel="canonical" href="https://jreyes.dev/"');
	});

	it('builds the canonical from the given path, not always the root', () => {
		const { head } = render(SeoHead, {
			props: { title: 'Work', description: 'Case studies.', path: '/work/' }
		});
		expect(head).toContain('href="https://jreyes.dev/work/"');
	});

	it('includes Open Graph and Twitter card tags derived from title/description', () => {
		const { head } = render(SeoHead, {
			props: { title: 'Field', description: 'Hummingbirds.', path: '/field/' }
		});
		expect(head).toContain('property="og:title" content="Field"');
		expect(head).toContain('property="og:description" content="Hummingbirds."');
		expect(head).toContain('name="twitter:card" content="summary"');
	});

	it('adds a noindex robots meta only when requested', () => {
		const indexed = render(SeoHead, { props: { title: 't', description: 'd', path: '/' } });
		expect(indexed.head).not.toContain('noindex');

		const hidden = render(SeoHead, {
			props: { title: 't', description: 'd', path: '/writing/', noindex: true }
		});
		expect(hidden.head).toContain('name="robots" content="noindex"');
	});
});
