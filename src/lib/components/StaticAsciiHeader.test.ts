import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import StaticAsciiHeader from './StaticAsciiHeader.svelte';

describe('StaticAsciiHeader', () => {
	it('renders a decorative, aria-hidden character field AND the given figlet art, with no script tag anywhere (zero-JS routes)', () => {
		const art = ' __\n|__|';
		const { body } = render(StaticAsciiHeader, { props: { art } });
		expect(body).toContain('aria-hidden="true"');
		expect(body).toContain('|__|');
		expect(body).not.toContain('<script');
	});

	it('produces a non-empty field of real characters, not just whitespace', () => {
		const { body } = render(StaticAsciiHeader, { props: { art: 'X' } });
		const fieldMatch = body.match(/<pre class="field[^>]*>([\s\S]*?)<\/pre>/);
		expect(fieldMatch).not.toBeNull();
		const nonBlank = [...(fieldMatch?.[1] ?? '')].filter((c) => c !== ' ' && c !== '\n');
		expect(nonBlank.length).toBeGreaterThan(0);
	});

	it('renders a different field for different `cols`/`rows` props (not a hardcoded string)', () => {
		const a = render(StaticAsciiHeader, { props: { art: 'X', cols: 40, rows: 6 } }).body;
		const b = render(StaticAsciiHeader, { props: { art: 'X', cols: 60, rows: 8 } }).body;
		expect(a).not.toBe(b);
	});

	// Approved header prototype port, requirement 5: /work/[slug]/'s
	// zero-JS header should read as ITS build's waveform (matching /work/'s
	// own live look) instead of the generic ambient cloud field every other
	// static header uses.
	it('renders a wave variant seeded from the build, not the generic ambient field', () => {
		const { body } = render(StaticAsciiHeader, {
			props: { art: 'X', variant: 'wave', seed: 'creditbay:20 → 600' }
		});
		const fieldMatch = body.match(/<pre class="field[^>]*>([\s\S]*?)<\/pre>/);
		expect(fieldMatch).not.toBeNull();
		// A wave trace uses these glyphs; the ambient cloud field's own ramp
		// (` .·:-=+*#%@`) never produces `/`, `\`, `‾` or `|`.
		expect(fieldMatch?.[1]).toMatch(/[/\\‾|]/);
	});

	it('the wave variant is deterministic per seed — the same build always draws the same header', () => {
		const a = render(StaticAsciiHeader, {
			props: { art: 'X', variant: 'wave', seed: 'creditbay:20 → 600' }
		}).body;
		const b = render(StaticAsciiHeader, {
			props: { art: 'X', variant: 'wave', seed: 'creditbay:20 → 600' }
		}).body;
		expect(a).toBe(b);
	});
});
