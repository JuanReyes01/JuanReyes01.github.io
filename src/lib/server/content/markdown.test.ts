import { describe, it, expect } from 'vitest';
import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
	it('extracts YAML frontmatter as data and renders the body to HTML', () => {
		const raw = '---\ntitle: Hello\n---\n\nHello **world**.\n';
		const { data, html } = parseMarkdown(raw);
		expect(data).toEqual({ title: 'Hello' });
		expect(html).toContain('<strong>world</strong>');
	});

	it('supports GFM strikethrough via remark-gfm', () => {
		const raw = '---\ntitle: X\n---\n\n~~gone~~\n';
		const { html } = parseMarkdown(raw);
		expect(html).toContain('<del>gone</del>');
	});

	it('returns an empty data object when there is no frontmatter', () => {
		const { data, html } = parseMarkdown('Just a paragraph.\n');
		expect(data).toEqual({});
		expect(html).toContain('Just a paragraph.');
	});
});
