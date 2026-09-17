import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

describe('404 page', () => {
	it('renders a single h1 and a way back home', () => {
		const { body } = render(Page, { props: {} });
		expect(body.match(/<h1[ >]/g)).toHaveLength(1);
		expect(body).toMatch(/href="\/"/);
	});

	it('is marked noindex', () => {
		const { head } = render(Page, { props: {} });
		expect(head).toContain('name="robots" content="noindex"');
	});
});
