import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

const DATA = {
	builds: [
		{
			slug: 'creditbay',
			build: 1,
			title: 'CreditBay',
			summary: 'A debt-recovery platform.',
			stack: ['python', 'fastapi'],
			metric: { value: '20 → 600', label: 'calls / min' }
		},
		{
			slug: 'amd',
			build: 2,
			title: 'Automatic Machine Detection',
			summary: 'Detects voicemail.',
			stack: ['telephony'],
			metric: { value: '~90%', label: 'lower call cost' }
		}
	]
};

describe('work index page (/work/)', () => {
	it('lists every build with a link to its case study and its metric', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toMatch(/href="\/work\/creditbay\/"/);
		expect(body).toMatch(/href="\/work\/amd\/"/);
		expect(body).toContain('20 → 600');
		expect(body).toContain('~90%');
	});

	it('has a single h1 for the page (the pane title)', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body.match(/<h1[ >]/g)).toHaveLength(1);
	});

	it('never mentions AMD as a company — only as a build', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toContain('Automatic Machine Detection');
	});
});
