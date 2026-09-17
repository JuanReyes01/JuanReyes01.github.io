import { describe, it, expect } from 'vitest';
import { GET } from './+server';

describe('GET /rss.xml', () => {
	it('serves well-formed XML with the site title, sourced from real content', async () => {
		const response = await GET({} as never);
		const text = await response.text();
		expect(response.headers.get('Content-Type')).toBe('application/xml');
		expect(text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(text).toContain('<title>Juan Camilo Reyes</title>');
	});
});
