import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import StaticAsciiHeader from './StaticAsciiHeader.svelte';

describe('StaticAsciiHeader', () => {
	it('renders a decorative, aria-hidden character field AND the given figlet art, with no script tag anywhere (zero-JS routes)', () => {
		const art = ' __\n|__|';
		const { body } = render(StaticAsciiHeader, { props: { art } });
		expect(body).toContain('aria-hidden="true"');
		expect(body).toContain('|__|');
		expect(body).not.toContain('<script');
	});

	it('produces a non-empty field of real characters, not just whitespace', () => {
		const { body } = render(StaticAsciiHeader, { props: { art: 'X' } });
		const fieldMatch = body.match(/<pre class="field[^>]*>([\s\S]*?)<\/pre>/);
		expect(fieldMatch).not.toBeNull();
		const nonBlank = [...(fieldMatch?.[1] ?? '')].filter((c) => c !== ' ' && c !== '\n');
		expect(nonBlank.length).toBeGreaterThan(0);
	});

	it('renders a different field for different `cols`/`rows` props (not a hardcoded string)', () => {
		const a = render(StaticAsciiHeader, { props: { art: 'X', cols: 40, rows: 6 } }).body;
		const b = render(StaticAsciiHeader, { props: { art: 'X', cols: 60, rows: 8 } }).body;
		expect(a).not.toBe(b);
	});
});
