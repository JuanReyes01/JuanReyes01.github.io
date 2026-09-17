import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import Pane from './Pane.svelte';

function textSnippet(text: string) {
	return createRawSnippet(() => ({
		render: () => `<p>${text}</p>`
	}));
}

describe('Pane', () => {
	it('renders a heading matching headingLevel, defaulting to h2', () => {
		const { body } = render(Pane, {
			props: { id: 'about', title: 'home', children: textSnippet('content') }
		});
		expect(body).toContain('<h2');
		expect(body).toContain('id="about-title"');
	});

	it('renders an h1 when headingLevel is 1 (the page-level pane)', () => {
		const { body } = render(Pane, {
			props: { id: 'work', title: 'work', headingLevel: 1, children: textSnippet('content') }
		});
		expect(body).toContain('<h1');
	});

	it('associates the section with its heading via aria-labelledby', () => {
		const { body } = render(Pane, {
			props: { id: 'field', title: 'field', children: textSnippet('content') }
		});
		expect(body).toContain('aria-labelledby="field-title"');
	});

	it('hides the decorative index/meta chrome from assistive tech', () => {
		const { body } = render(Pane, {
			props: {
				id: 'work',
				title: 'work',
				index: 3,
				meta: 'judged by one number',
				children: textSnippet('content')
			}
		});
		expect(body).toMatch(/<span class="k[^"]*" aria-hidden="true">\[3\]<\/span>/);
		expect(body).toMatch(/class="pane-meta[^"]*" aria-hidden="true"/);
	});
});
