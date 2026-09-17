import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Strip from './Strip.svelte';

describe('Strip', () => {
	it('renders a static, decorative inline svg (no interactivity, no client JS needed)', () => {
		const { body } = render(Strip, { props: {} });
		expect(body).toContain('<svg');
		expect(body).toContain('aria-hidden="true"');
	});

	it('renders ONE path element carrying every dot, styled by class (design R2: "in the section colour" via CSS, not inline color)', () => {
		const { body } = render(Strip, { props: {} });
		expect(body.match(/<path/g)).toHaveLength(1); // a single path, not one element per dot (page-weight fix)
		expect(body).toMatch(/<path class="dot[^"]*" d="M/);
		expect(body).not.toMatch(/style="[^"]*fill/); // color comes from the scoped `.dot` rule, never inline
	});

	it('samples at a real dither resolution by default — legacy Strip used ~2px cells, not a coarse handful', () => {
		const { body } = render(Strip, { props: {} });
		// design R2 follow-up fix: default grid must be fine enough that each
		// cell renders at roughly legacy's 2-3 CSS px, not the original
		// 48x10 grid that stretched into ~12px blocks on a real pane header.
		expect(body).toMatch(/viewBox="0 0 (2\d{2}|[3-9]\d{2}) \d+"/);
	});

	it('crops instead of stretching, so dots stay square at any container aspect ratio (no "none" distortion)', () => {
		const { body } = render(Strip, { props: {} });
		expect(body).toContain('preserveAspectRatio="xMidYMid slice"');
	});

	it('renders crisp, non-anti-aliased dot edges', () => {
		const { body } = render(Strip, { props: {} });
		expect(body).toContain('shape-rendering="crispEdges"');
	});

	it('scales to its container instead of a fixed pixel size, so it never forces horizontal scroll', () => {
		const { body } = render(Strip, { props: {} });
		expect(body).toMatch(/viewBox="0 0 \d+ \d+"/);
		expect(body).not.toMatch(/width="\d+px"/);
	});
});
