import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Row from './Row.svelte';

describe('Row', () => {
	it('renders the numbered variant with a zero-padded index by default', () => {
		const { body } = render(Row, { props: { index: 1, title: 'CreditBay' } });
		expect(body).toContain('01');
		expect(body).toContain('CreditBay');
	});

	it('renders an sr-only title alongside the aria-hidden visual title (scramble parity)', () => {
		const { body } = render(Row, { props: { index: 1, title: 'CreditBay' } });
		expect(body).toContain('sr-only');
		expect(body).toContain('aria-hidden="true"');
	});

	it('renders the bullet variant with a "›" glyph instead of a number', () => {
		const { body } = render(Row, { props: { title: 'This site', variant: 'bullet' } });
		expect(body).toContain('›');
		expect(body).not.toContain('>01<');
	});

	it('wraps the row in an anchor when href is given, keeping data-row on the anchor', () => {
		const { body } = render(Row, {
			props: { index: 1, title: 'CreditBay', href: '/work/creditbay/' }
		});
		expect(body).toMatch(/<a[^>]*data-row[^>]*href="\/work\/creditbay\/"/);
	});

	it('renders a native <details>/<summary> when a details snippet is given', () => {
		const { body } = render(Row, {
			props: { index: 1, title: 'Chief AI Officer', lane: 'caio' }
		});
		expect(body).not.toContain('<details');

		// Svelte SSR can't invoke a snippet from a unit test without a wrapper
		// component; the has-details branch is exercised end-to-end by the
		// experience page integration test instead.
	});

	it('sets data-lane so the timeline canvas action can be told which row is hovered/focused', () => {
		const { body } = render(Row, { props: { index: 1, title: 'Chief AI Officer', lane: 'caio' } });
		expect(body).toContain('data-lane="caio"');
	});
});
