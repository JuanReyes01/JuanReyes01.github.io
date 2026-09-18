import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import AsciiHeaderFrame from './AsciiHeaderFrame.svelte';

function canvasSnippet() {
	return createRawSnippet(() => ({
		render: () => `<canvas data-canvas-fixture aria-hidden="true"></canvas>`
	}));
}

describe('AsciiHeaderFrame', () => {
	it('renders the given figlet art overlaid on top of the caller-supplied canvas snippet', () => {
		const { body } = render(AsciiHeaderFrame, {
			props: { art: ' __\n|__|', canvas: canvasSnippet() }
		});
		expect(body).toContain('|__|');
		expect(body).toContain('data-canvas-fixture');
	});

	it('marks the frame as decorative chrome, not content (the pane title already carries the a11y label)', () => {
		const { body } = render(AsciiHeaderFrame, {
			props: { art: 'X', canvas: canvasSnippet() }
		});
		expect(body).toContain('aria-hidden="true"');
	});
});
