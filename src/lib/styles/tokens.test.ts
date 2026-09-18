import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The colour tokens are CSS, so nothing in the TypeScript test suite could
 * catch a palette that stops being readable — and a contrast regression is
 * invisible until someone with the "wrong" theme opens the site. This parses
 * `tokens.css` itself and holds the palette to WCAG 2.1 contrast, per theme.
 */
const CSS = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** The bare `:root` block is the DARK theme (tokens.css is dark-first); the
    `[data-theme='light']` block is the light one. Both are parsed from the
    same file so the test can never drift from what ships. */
function themeTokens(selector: string): Record<string, string> {
	const start = CSS.indexOf(selector);
	expect(start, `${selector} must exist in tokens.css`).toBeGreaterThan(-1);
	const open = CSS.indexOf('{', start);
	const close = CSS.indexOf('}', open);
	const body = CSS.slice(open + 1, close);
	const out: Record<string, string> = {};
	for (const [, name, value] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
		out[name] = value.trim();
	}
	return out;
}

const DARK = themeTokens(':root {');
const LIGHT = themeTokens("[data-theme='light']");

function channel(value: number): number {
	const c = value / 255;
	return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
	const h = hex.replace('#', '');
	const n = Number.parseInt(h, 16);
	return (
		0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
	);
}

/** WCAG 2.1 contrast ratio between two opaque hex colours. */
function contrast(a: string, b: string): number {
	const la = luminance(a);
	const lb = luminance(b);
	const [hi, lo] = la > lb ? [la, lb] : [lb, la];
	return (hi + 0.05) / (lo + 0.05);
}

const ACCENTS = ['cyan', 'magenta', 'yellow', 'green', 'blue', 'pink'] as const;
const THEMES: Array<[string, Record<string, string>]> = [
	['dark', DARK],
	['light', LIGHT]
];

describe('colour tokens', () => {
	it('defines every token in both themes', () => {
		for (const name of Object.keys(DARK)) {
			if (!name.startsWith('font') && name !== 'status-h') {
				expect(LIGHT[name], `--${name} must exist in the light theme too`).toBeDefined();
			}
		}
	});

	it.each(THEMES)('reads body copy on every surface in the %s theme', (_theme, tokens) => {
		for (const surface of ['bg', 'surface', 'banner']) {
			expect(contrast(tokens.fg, tokens[surface])).toBeGreaterThanOrEqual(4.5);
			expect(contrast(tokens['fg-2'], tokens[surface])).toBeGreaterThanOrEqual(4.5);
		}
	});

	// `--muted` is secondary copy (prompt, meta, captions) at body size, so it
	// takes the same 4.5:1 bar as the rest of the text.
	it.each(THEMES)('reads muted copy on the page ground in the %s theme', (_theme, tokens) => {
		expect(contrast(tokens.muted, tokens.bg)).toBeGreaterThanOrEqual(4.5);
	});

	// Accents are not decoration here: they are tab labels, links, the shell
	// prompt, metric values and diagram highlights — all normal-size text, and
	// `--banner` is the ground behind the tab bar and the diagram blocks.
	it.each(THEMES)('reads accent TEXT on bg and banner in the %s theme', (_theme, tokens) => {
		for (const accent of ACCENTS) {
			expect(
				contrast(tokens[accent], tokens.bg),
				`--${accent} on --bg is ${contrast(tokens[accent], tokens.bg).toFixed(2)}:1`
			).toBeGreaterThanOrEqual(4.5);
			expect(
				contrast(tokens[accent], tokens.banner),
				`--${accent} on --banner is ${contrast(tokens[accent], tokens.banner).toFixed(2)}:1`
			).toBeGreaterThanOrEqual(4.5);
		}
	});
});
