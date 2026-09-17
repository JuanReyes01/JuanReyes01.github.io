import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Figlet from './Figlet.svelte';

describe('Figlet', () => {
	it('renders the given ascii art verbatim inside a decorative, aria-hidden pre', () => {
		const art = ' __\n|__|';
		const { body } = render(Figlet, { props: { art } });
		expect(body).toContain('aria-hidden="true"');
		expect(body).toContain('|__|');
	});
});
