import { describe, it, expect } from 'vitest';
import { GET } from './+server';

describe('GET /sitemap.xml', () => {
	it('serves well-formed XML covering the real static routes and work slugs', async () => {
		const response = await GET({} as never);
		const text = await response.text();
		expect(response.headers.get('Content-Type')).toBe('application/xml');
		expect(text).toContain('<loc>https://jreyes.dev/</loc>');
		expect(text).toContain('<loc>https://jreyes.dev/work/creditbay/</loc>');
		expect(text).not.toContain('/writing/</loc>');
	});
});
