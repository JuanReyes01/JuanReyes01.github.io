import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Strip from './Strip.svelte';

describe('Strip', () => {
	it('renders a static, decorative inline svg (no interactivity, no client JS needed)', () => {
		const { body } = render(Strip, { props: {} });
		expect(body).toContain('<svg');
		expect(body).toContain('aria-hidden="true"');
	});

	it('renders at least one dot, styled by class (design R2: "in the section colour" via CSS, not inline color)', () => {
		const { body } = render(Strip, { props: { cols: 48, rows: 10 } });
		expect(body).toMatch(/<rect class="dot[^"]*"/);
		expect(body).not.toMatch(/style="[^"]*fill/); // color comes from the scoped `.dot` rule, never inline
	});

	it('scales to its container instead of a fixed pixel size, so it never forces horizontal scroll', () => {
		const { body } = render(Strip, { props: {} });
		expect(body).toMatch(/viewBox="0 0 \d+ \d+"/);
		expect(body).not.toMatch(/width="\d+px"/);
	});
});
