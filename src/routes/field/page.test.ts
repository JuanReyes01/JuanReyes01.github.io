import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

const DATA = {
	bodyHtml:
		'<p>Software and electronics for <strong>Centro de Investigación Colibrí Gorriazul</strong>, a hummingbird research center in Fusagasugá, Cundinamarca.</p>',
	diagram: {
		caption: 'how a visit becomes a result',
		label: 'Pipeline diagram',
		art: 'A -> B',
		name: 'feeder-rfid'
	},
	stations: [
		{ title: 'Solar autonomy', desc: 'A design proposal.', kind: 'proposal' },
		{ title: 'ESP32 trap controller', desc: 'Firmware.', stack: ['c', 'esp-idf'], kind: 'firmware' }
	]
};

describe('field page (/field/)', () => {
	it('renders the research center name and prose from validated content', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toContain('Centro de Investigación Colibrí Gorriazul');
	});

	it('renders the RFID pipeline diagram with an accessible label', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toContain('role="img"');
		expect(body).toContain('feeder-rfid');
	});

	it('renders each station row', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toContain('Solar autonomy');
		expect(body).toContain('ESP32 trap controller');
		expect(body).toContain('proposal');
		expect(body).toContain('firmware');
	});

	it('never mentions homelab content', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body.toLowerCase()).not.toContain('homelab');
	});

	it('has a single h1 for the page (the pane title)', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body.match(/<h1[ >]/g)).toHaveLength(1);
	});

	it('the band canvas is decorative (aria-hidden, not conveying information)', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toMatch(/<canvas aria-hidden="true"/);
	});

	// design #4938 slice S2: the hummingbird moved here from the home hero,
	// drawn into the band's own grid — one canvas, not a second one for the bird.
	it('renders exactly one canvas — band and hummingbird share it', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body.match(/<canvas/g)).toHaveLength(1);
	});
});
