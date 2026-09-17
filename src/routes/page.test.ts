import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

const DATA = {
	bioHtml:
		"<p>I'm an <strong>electronics and systems engineer</strong> from Bogotá, Colombia.</p><p>Off the clock it's a 3D printer, a riced Hyprland desktop, and software and hardware for biologists who study hummingbirds.</p>",
	now: [{ title: 'Ship the site', desc: 'On its way to jreyes.dev.', tags: ['#web'] }],
	how: [{ title: 'Red, green, refactor', desc: 'No merge without tests.', tags: ['#tdd'] }],
	highlights: [
		{
			slug: 'creditbay',
			build: 1,
			title: 'CreditBay',
			summary: 'A debt-recovery platform.',
			metric: { value: '20 → 600', label: 'calls / min' }
		}
	]
};

describe('home page (/)', () => {
	it('renders the exact hero prompt', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toContain('juan@laptop');
		expect(body.replace(/<[^>]+>/g, '')).toContain('juan@laptop:~$ whoami');
	});

	it('renders exactly one GitHub link and one LinkedIn link', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body.match(/href="https:\/\/github\.com\/JuanReyes01"/g)).toHaveLength(1);
		expect(body.match(/href="https:\/\/www\.linkedin\.com\//g)).toHaveLength(1);
	});

	it('never renders an email address', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
	});

	it('renders both bio paragraphs from the validated content HTML', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toContain('electronics and systems engineer');
		expect(body).toContain('riced Hyprland desktop');
	});

	it('renders the blinking cursor next to the greeting', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toMatch(/class="cursor[ "]/);
	});

	it('renders now/how index rows and a highlight row linking to its case study', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toContain('Ship the site');
		expect(body).toContain('Red, green, refactor');
		expect(body).toMatch(/href="\/work\/creditbay\/"/);
		expect(body).toContain('20 → 600');
	});

	it('has a single h1 (the pane title) with the greeting as a subordinate heading', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body.match(/<h1[ >]/g)).toHaveLength(1);
		expect(body).toContain('<h2 id="hello"');
	});
});
