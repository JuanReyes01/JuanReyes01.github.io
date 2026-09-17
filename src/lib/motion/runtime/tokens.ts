/**
 * Shared design-token access for every canvas engine (design D14): one
 * `readTokens`-equivalent, ported from the legacy inline theme reader, plus
 * a theme-change watcher (color-scheme media query + `[data-theme]`
 * mutation) so engines can redraw with the new palette instead of polling.
 * Every browser touchpoint (`getComputedStyle`, `matchMedia`,
 * `MutationObserver`) is injected so this stays testable without jsdom.
 */

export interface Tokens {
	bg: string;
	banner: string;
	fg: string;
	fg2: string;
	muted: string;
	line: string;
	cyan: string;
	magenta: string;
	yellow: string;
	green: string;
	blue: string;
	pink: string;
}

/** The legacy engine's fallback for a token that fails to resolve. */
const FALLBACK_COLOR = '#c8cbe0';

/** `[Tokens key, CSS custom property name]`, mirroring the legacy `TOKEN_NAMES` order. */
const TOKEN_KEYS: Array<[keyof Tokens, string]> = [
	['bg', 'bg'],
	['banner', 'banner'],
	['fg', 'fg'],
	['fg2', 'fg-2'],
	['muted', 'muted'],
	['line', 'line'],
	['cyan', 'cyan'],
	['magenta', 'magenta'],
	['yellow', 'yellow'],
	['green', 'green'],
	['blue', 'blue'],
	['pink', 'pink']
];

/** Reads every design token via an injected CSS custom-property reader. */
export function parseTokens(readVar: (name: string) => string): Tokens {
	const tokens = {} as Tokens;
	for (const [key, cssName] of TOKEN_KEYS) {
		tokens[key] = readVar(`--${cssName}`).trim() || FALLBACK_COLOR;
	}
	return tokens;
}

/** Parses a `#rgb` or `#rrggbb` hex color into `[r, g, b]`, matching the legacy `hex()` helper. */
export function hexToRgb(value: string): [number, number, number] {
	let h = (value || '').trim().replace('#', '');
	if (h.length === 3) h = h.replace(/./g, (c) => c + c);
	const n = parseInt(h, 16);
	if (Number.isNaN(n)) return [200, 200, 210];
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Formats a hex token color as an `rgba(r,g,b,a)` string. */
export function tokenRgba(hex: string, alpha: number): string {
	const [r, g, b] = hexToRgb(hex);
	return `rgba(${r},${g},${b},${alpha})`;
}

interface MediaQueryLike {
	matches: boolean;
	addEventListener(type: 'change', callback: () => void): void;
	removeEventListener(type: 'change', callback: () => void): void;
}

export interface ThemeWatcherDeps {
	readVar: (name: string) => string;
	matchDarkScheme: () => MediaQueryLike;
	/** Sets up the `[data-theme]` attribute observer; returns a disconnect function. */
	observeAttribute: (onChange: () => void) => () => void;
}

export interface ThemeWatcher {
	get(): Tokens;
	subscribe(callback: (tokens: Tokens) => void): () => void;
	destroy(): void;
}

/** A shared theme watcher: one `matchMedia` listener + one attribute observer for every engine. */
export function createThemeWatcher(deps: ThemeWatcherDeps): ThemeWatcher {
	const subscribers = new Set<(tokens: Tokens) => void>();
	const notify = () => {
		const tokens = parseTokens(deps.readVar);
		for (const callback of subscribers) callback(tokens);
	};

	const media = deps.matchDarkScheme();
	media.addEventListener('change', notify);
	const disconnectAttribute = deps.observeAttribute(notify);

	return {
		get: () => parseTokens(deps.readVar),
		subscribe(callback) {
			subscribers.add(callback);
			return () => {
				subscribers.delete(callback);
			};
		},
		destroy() {
			media.removeEventListener('change', notify);
			disconnectAttribute();
			subscribers.clear();
		}
	};
}
