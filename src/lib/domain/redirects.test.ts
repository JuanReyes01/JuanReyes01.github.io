import { describe, it, expect } from 'vitest';
import {
	LEGACY_ANCHORS,
	resolveLegacyAnchor,
	buildLegacyRedirectScript,
	EXPERIENCE_REDIRECT_TARGET,
	buildExperienceRedirectScript
} from './redirects';

describe('resolveLegacyAnchor', () => {
	it('resolves #field to the field route', () => {
		expect(resolveLegacyAnchor('#field')).toBe('/field/');
	});

	it('resolves #timeline straight to /work/, not through the /experience/ redirect stub (v2 direction slice S1: avoid a double hop for old bookmarks)', () => {
		expect(resolveLegacyAnchor('#timeline')).toBe('/work/');
	});

	it('resolves #builds to the work route', () => {
		expect(resolveLegacyAnchor('#builds')).toBe('/work/');
	});

	it('resolves #about to the home route', () => {
		expect(resolveLegacyAnchor('#about')).toBe('/');
	});

	it('returns undefined for a hash with no legacy mapping', () => {
		expect(resolveLegacyAnchor('#nope')).toBeUndefined();
	});
});

describe('buildLegacyRedirectScript', () => {
	it('embeds every legacy anchor mapping as parseable JSON', () => {
		const script = buildLegacyRedirectScript();
		expect(script).toContain(JSON.stringify(LEGACY_ANCHORS));
	});

	it('reads location.hash and calls location.replace with the mapped target', () => {
		const script = buildLegacyRedirectScript();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const location: any = { hash: '#field', replace: (url: string) => (location.replaced = url) };
		new Function('location', script)(location);
		expect(location.replaced).toBe('/field/');
	});

	it('does not call location.replace when the hash has no legacy mapping', () => {
		const script = buildLegacyRedirectScript();
		let replaced: string | null = null;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const location: any = { hash: '#nope', replace: (url: string) => (replaced = url) };
		new Function('location', script)(location);
		expect(replaced).toBeNull();
	});
});

describe('buildExperienceRedirectScript (v2 direction slice S1: /experience/ merged into /work/)', () => {
	it('targets /work/', () => {
		expect(EXPERIENCE_REDIRECT_TARGET).toBe('/work/');
	});

	it('calls location.replace with the redirect target', () => {
		const script = buildExperienceRedirectScript();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const location: any = { replace: (url: string) => (location.replaced = url) };
		new Function('location', script)(location);
		expect(location.replaced).toBe(EXPERIENCE_REDIRECT_TARGET);
	});
});
