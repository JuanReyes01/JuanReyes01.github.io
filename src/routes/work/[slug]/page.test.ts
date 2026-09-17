import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

const CREDITBAY = {
	slug: 'creditbay',
	title: 'CreditBay',
	build: 1,
	summary: 'A debt-recovery platform.',
	stack: ['python', 'fastapi'],
	metric: { value: '20 → 600', label: 'calls / min' },
	problem: 'Debt collectors call thousands of accounts a day.',
	decisions: ['A FastAPI monorepo split into ERP and CRM services.'],
	results: [{ value: '20 → 600', label: 'calls / min' }],
	bodyHtml: '<p>An ERP service holds the portfolio.</p>'
};

const WITH_DIAGRAM = {
	...CREDITBAY,
	diagram: {
		caption: 'how it works',
		label: 'Pipeline diagram',
		art: 'A -> B',
		name: 'feeder-rfid'
	}
};

describe('work case study page (/work/[slug]/)', () => {
	it('renders the problem, decisions and results sections', () => {
		const { body } = render(Page, { props: { data: CREDITBAY } });
		expect(body).toContain('Debt collectors call thousands of accounts a day.');
		expect(body).toContain('A FastAPI monorepo split into ERP and CRM services.');
		expect(body).toContain('20 → 600');
	});

	it('renders the diagram only when the content provides one', () => {
		const withoutDiagram = render(Page, { props: { data: CREDITBAY } });
		expect(withoutDiagram.body).not.toContain('role="img"');

		const withDiagram = render(Page, { props: { data: WITH_DIAGRAM } });
		expect(withDiagram.body).toContain('role="img"');
		expect(withDiagram.body).toContain('feeder-rfid');
	});

	it('has a single h1 (the case study title)', () => {
		const { body } = render(Page, { props: { data: CREDITBAY } });
		expect(body.match(/<h1[ >]/g)).toHaveLength(1);
	});

	it('links back to the work index', () => {
		const { body } = render(Page, { props: { data: CREDITBAY } });
		expect(body).toMatch(/href="\/work\/"/);
	});
});
