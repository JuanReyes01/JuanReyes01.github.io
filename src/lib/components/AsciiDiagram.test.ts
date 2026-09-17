import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import AsciiDiagram from './AsciiDiagram.svelte';

describe('AsciiDiagram', () => {
	it('renders the caption alone when no name is given', () => {
		const { body } = render(AsciiDiagram, {
			props: { art: 'x', caption: 'how a visit becomes a result', label: 'Pipeline diagram' }
		});
		expect(body).toContain('how a visit becomes a result');
		expect(body).not.toContain('<b>');
	});

	it('prefixes the caption with a bold name when one is given (legacy figcaption parity)', () => {
		const { body } = render(AsciiDiagram, {
			props: {
				art: 'x',
				caption: 'how a visit becomes a result',
				label: 'Pipeline diagram',
				name: 'feeder-rfid'
			}
		});
		const flattened = body.replace(/<!--.*?-->/g, '').replace(/\s+/g, ' ');
		expect(flattened).toContain('<b>feeder-rfid</b> — how a visit becomes a result');
	});
});
