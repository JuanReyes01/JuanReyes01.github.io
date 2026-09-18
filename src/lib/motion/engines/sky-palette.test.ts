import { describe, it, expect } from 'vitest';
import { resolveSkyColor } from './sky-palette';
import { tokenRgba } from '../runtime/tokens';
import type { Tokens } from '../runtime/tokens';

const TOKENS: Tokens = {
	bg: '#0e1424',
	banner: '#0a0f1c',
	fg: '#e8e6f0',
	fg2: '#c8cbe0',
	muted: '#8a95b8',
	line: '#2a3655',
	cyan: '#2fe0c6',
	magenta: '#b07af5',
	yellow: '#f2c97e',
	green: '#7ee08c',
	blue: '#5aa7f5',
	pink: '#f25477'
};

describe('resolveSkyColor', () => {
	it('gives the hummingbird its real colors: green body, blue crown, pink gorget', () => {
		expect(resolveSkyColor('body', TOKENS)).toBe(TOKENS.green);
		expect(resolveSkyColor('crown', TOKENS)).toBe(TOKENS.blue);
		expect(resolveSkyColor('gorget', TOKENS)).toBe(TOKENS.pink);
		expect(resolveSkyColor('gorget2', TOKENS)).toBe(TOKENS.magenta);
	});

	it('makes the wings translucent (rgba with a fractional alpha, not a solid token)', () => {
		expect(resolveSkyColor('wing', TOKENS)).toMatch(/^rgba\(/);
		expect(resolveSkyColor('ghost', TOKENS)).toMatch(/^rgba\(/);
		expect(resolveSkyColor('farwing', TOKENS)).toMatch(/^rgba\(/);
	});

	it('gives the flower pink petals, a yellow center and a green stem/leaf', () => {
		expect(resolveSkyColor('petal', TOKENS)).toBe(TOKENS.pink);
		expect(resolveSkyColor('fcenter', TOKENS)).toBe(TOKENS.yellow);
		expect(resolveSkyColor('stem', TOKENS)).toMatch(/^rgba\(/);
		expect(resolveSkyColor('leaf', TOKENS)).toMatch(/^rgba\(/);
	});

	it('resolves the ripple hot-spot colors to pink (crest) and cyan (trough)', () => {
		expect(resolveSkyColor('hotP', TOKENS)).toBe(TOKENS.pink);
		expect(resolveSkyColor('hotC', TOKENS)).toBe(TOKENS.cyan);
	});

	it('resolves the ambient cloud color bands to translucent cyan/blue/magenta pairs', () => {
		expect(resolveSkyColor('c0', TOKENS)).toMatch(/^rgba\(/);
		expect(resolveSkyColor('c1', TOKENS)).toMatch(/^rgba\(/);
		expect(resolveSkyColor('b0', TOKENS)).toMatch(/^rgba\(/);
		expect(resolveSkyColor('b1', TOKENS)).toMatch(/^rgba\(/);
		expect(resolveSkyColor('m0', TOKENS)).toMatch(/^rgba\(/);
		expect(resolveSkyColor('m1', TOKENS)).toMatch(/^rgba\(/);
	});

	// Medium-intensity port (owner-approved header prototype v5): the faint
	// ("0"-suffixed) ambient tone is raised from alpha 0.26 to 0.33 so the
	// field's own low end still reads as visible texture, not near-invisible.
	it('raises the faint ambient tone alpha to 0.33 (up from 0.26)', () => {
		expect(resolveSkyColor('c0', TOKENS)).toBe(tokenRgba(TOKENS.cyan, 0.33));
		expect(resolveSkyColor('b0', TOKENS)).toBe(tokenRgba(TOKENS.blue, 0.33));
		expect(resolveSkyColor('m0', TOKENS)).toBe(tokenRgba(TOKENS.magenta, 0.33));
	});
});
