import { describe, it, expect, vi } from 'vitest';
import { createThemeWatcher, hexToRgb, parseCssColor, parseTokens, tokenRgba } from './tokens';

describe('parseTokens', () => {
	it('reads every design token by its CSS custom property name', () => {
		const values: Record<string, string> = {
			'--bg': '#0e1424',
			'--banner': '#0a0f1c',
			'--fg': '#e8e6f0',
			'--fg-2': '#c8cbe0',
			'--muted': '#8a95b8',
			'--line': '#2a3655',
			'--cyan': '#2fe0c6',
			'--magenta': '#b07af5',
			'--yellow': '#f2c97e',
			'--green': '#7ee08c',
			'--blue': '#5aa7f5',
			'--pink': '#f25477'
		};
		const tokens = parseTokens((name) => values[name] ?? '');
		expect(tokens).toEqual({
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
		});
	});

	it('trims whitespace and falls back to the legacy default for a missing token', () => {
		const tokens = parseTokens((name) => (name === '--fg' ? '  #ffffff  ' : ''));
		expect(tokens.fg).toBe('#ffffff');
		expect(tokens.cyan).toBe('#c8cbe0');
	});
});

describe('hexToRgb', () => {
	it('parses a 6-digit hex color', () => {
		expect(hexToRgb('#2fe0c6')).toEqual([47, 224, 198]);
	});

	it('expands a 3-digit shorthand hex color', () => {
		expect(hexToRgb('#0f0')).toEqual([0, 255, 0]);
	});

	it('falls back to the legacy neutral gray for an invalid value', () => {
		expect(hexToRgb('not-a-color')).toEqual([200, 200, 210]);
	});
});

describe('tokenRgba', () => {
	it('formats a hex token as an rgba() string with the given alpha', () => {
		expect(tokenRgba('#2fe0c6', 0.6)).toBe('rgba(47,224,198,0.6)');
	});
});

describe('parseCssColor', () => {
	it('parses a hex color to fully-opaque channels', () => {
		expect(parseCssColor('#2fe0c6')).toEqual({ r: 47, g: 224, b: 198, a: 1 });
	});

	it('parses an rgba() string produced by tokenRgba back into its channels', () => {
		expect(parseCssColor('rgba(47,224,198,0.6)')).toEqual({ r: 47, g: 224, b: 198, a: 0.6 });
	});

	it('defaults alpha to 1 for a bare rgb() string', () => {
		expect(parseCssColor('rgb(10,20,30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 });
	});
});

describe('createThemeWatcher', () => {
	function setup() {
		let schemeChange: (() => void) | null = null;
		let attrChange: (() => void) | null = null;
		let disconnected = false;
		const values: Record<string, string> = { '--fg': '#111111' };
		const watcher = createThemeWatcher({
			readVar: (name) => values[name] ?? '',
			matchDarkScheme: () => ({
				matches: true,
				addEventListener: (_type, cb) => {
					schemeChange = cb;
				},
				removeEventListener: () => {
					schemeChange = null;
				}
			}),
			observeAttribute: (onChange) => {
				attrChange = onChange;
				return () => {
					disconnected = true;
				};
			}
		});
		return {
			watcher,
			values,
			fireSchemeChange: () => schemeChange?.(),
			fireAttrChange: () => attrChange?.(),
			isDisconnected: () => disconnected
		};
	}

	it('get() reads the current tokens', () => {
		const { watcher } = setup();
		expect(watcher.get().fg).toBe('#111111');
	});

	it('notifies subscribers with fresh tokens on a color-scheme change', () => {
		const { watcher, values, fireSchemeChange } = setup();
		const cb = vi.fn();
		watcher.subscribe(cb);
		values['--fg'] = '#222222';
		fireSchemeChange();
		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb.mock.calls[0][0].fg).toBe('#222222');
	});

	it('notifies subscribers on a [data-theme] attribute change', () => {
		const { watcher, values, fireAttrChange } = setup();
		const cb = vi.fn();
		watcher.subscribe(cb);
		values['--fg'] = '#333333';
		fireAttrChange();
		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb.mock.calls[0][0].fg).toBe('#333333');
	});

	it('notifies every subscriber, and unsubscribe stops future notifications', () => {
		const { watcher, fireSchemeChange } = setup();
		const a = vi.fn();
		const b = vi.fn();
		const unsubscribeA = watcher.subscribe(a);
		watcher.subscribe(b);
		unsubscribeA();
		fireSchemeChange();
		expect(a).not.toHaveBeenCalled();
		expect(b).toHaveBeenCalledTimes(1);
	});

	it('destroy() detaches both listeners', () => {
		const { watcher, isDisconnected } = setup();
		watcher.destroy();
		expect(isDisconnected()).toBe(true);
	});
});
