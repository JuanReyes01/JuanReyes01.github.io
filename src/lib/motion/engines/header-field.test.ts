import { describe, it, expect } from 'vitest';
import { HeaderFieldEngine } from './header-field';
import type { Engine } from '../runtime/canvas-action';
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

function rect(overrides: Partial<{ width: number; height: number }> = {}) {
	return { top: 0, left: 0, width: 0, height: 0, ...overrides };
}

function fakeCanvas(width = 1200, height = 220) {
	const drawn: Array<{ text: string; color: string }> = [];
	let fillTextCalls = 0;
	const ctx = {
		fillStyle: '',
		font: '',
		textBaseline: '',
		setTransform: () => {},
		clearRect: () => {},
		measureText: () => ({ width: 7 }),
		fillText: (text: string) => {
			fillTextCalls++;
			drawn.push({ text, color: ctx.fillStyle as string });
		}
	};
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => ctx,
		getBoundingClientRect: () => rect({ width, height })
	};
	return {
		canvas: canvas as unknown as HTMLCanvasElement,
		fillTextCallCount: () => fillTextCalls,
		drawn
	};
}

function makeEngine(
	section: 'about' | 'work' | 'field',
	reduced = false,
	width = 1200,
	height = 220
) {
	const { canvas, fillTextCallCount, drawn } = fakeCanvas(width, height);
	const engine = new HeaderFieldEngine({ canvas, tokens: TOKENS, reduced, section });
	engine.resize();
	return { engine, fillTextCallCount, drawn };
}

describe('HeaderFieldEngine', () => {
	it('draws glyphs to the canvas without throwing', () => {
		const { engine, fillTextCallCount } = makeEngine('work');
		engine.draw(0);
		expect(fillTextCallCount()).toBeGreaterThan(0);
	});

	it('never settles while ambient (visible, not reduced)', () => {
		const { engine } = makeEngine('work', false);
		expect(engine.isSettled()).toBe(false);
	});

	it('is always settled under reduced motion (one static frame)', () => {
		const { engine } = makeEngine('work', true);
		expect(engine.isSettled()).toBe(true);
	});

	it('setVisibility() is a no-op — the shared scheduler already gates visibility (R1)', () => {
		const { engine } = makeEngine('work');
		expect(() => (engine as Engine).setVisibility(true, 0.6)).not.toThrow();
	});

	it('renders a deterministic frame under reduced motion regardless of `now`', () => {
		const { engine: a, drawn: drawnA } = makeEngine('work', true);
		a.draw(0);
		const { engine: b, drawn: drawnB } = makeEngine('work', true);
		b.draw(999999);
		expect(drawnB).toEqual(drawnA);
	});

	it('paints only the section accent colors — the two tokens colorsForSection maps "work" to', () => {
		const { engine, drawn } = makeEngine('work');
		engine.draw(0);
		const colorsUsed = new Set(drawn.map((d) => d.color));
		expect(colorsUsed.size).toBeGreaterThan(0);
		for (const color of colorsUsed) {
			const isYellowish = hexToRgbaPrefix(TOKENS.yellow, color);
			const isPinkish = hexToRgbaPrefix(TOKENS.pink, color);
			expect(isYellowish || isPinkish).toBe(true);
		}
	});

	it('paints a different accent pair for "field" than for "work" (section-scoped color, not hardcoded)', () => {
		const { engine, drawn } = makeEngine('field');
		engine.draw(0);
		const colorsUsed = new Set(drawn.map((d) => d.color));
		for (const color of colorsUsed) {
			const isGreenish = hexToRgbaPrefix(TOKENS.green, color);
			const isCyanish = hexToRgbaPrefix(TOKENS.cyan, color);
			expect(isGreenish || isCyanish).toBe(true);
		}
	});

	it('traces field edges with directional glyphs and keeps flat interiors on the density ramp', () => {
		const { engine, drawn } = makeEngine('work', false, 1280, 260);
		engine.draw(0);
		const allChars = drawn.map((d) => d.text).join('');
		const edgeGlyphs = [...allChars].filter((c) => '|/\\'.includes(c));
		const densityGlyphs = [...allChars].filter((c) => '.·:=+*#%@'.includes(c));
		expect(edgeGlyphs.length).toBeGreaterThan(0);
		expect(densityGlyphs.length).toBeGreaterThan(0);
	});

	it('batches draws per row and color key: fillText calls stay far below cell count (E4)', () => {
		const { engine, fillTextCallCount } = makeEngine('work', false, 1280, 260);
		engine.draw(0);
		expect(fillTextCallCount()).toBeGreaterThan(0);
		expect(fillTextCallCount()).toBeLessThan(600);
	});

	it('poke() and setReduced() do not throw', () => {
		const { engine } = makeEngine('work');
		engine.draw(0);
		expect(() => engine.poke(100, 100, 5)).not.toThrow();
		expect(() => engine.setReduced(true)).not.toThrow();
		expect(() => engine.draw(16)).not.toThrow();
	});

	it('resize()/draw() do not throw for a zero-width rect (unlaid-out canvas)', () => {
		const { canvas } = fakeCanvas(0, 0);
		const engine = new HeaderFieldEngine({
			canvas,
			tokens: TOKENS,
			reduced: false,
			section: 'work'
		});
		expect(() => engine.resize()).not.toThrow();
		expect(() => engine.draw(0)).not.toThrow();
	});
});

/** rgba(r,g,b,a) strings are used for the accent colors (design tokenRgba
 * convention) — this checks the drawn color's RGB channels match the hex
 * token's own channels, regardless of which alpha was picked. */
function hexToRgbaPrefix(hex: string, candidate: string): boolean {
	const n = parseInt(hex.replace('#', ''), 16);
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return candidate.startsWith(`rgba(${r},${g},${b},`);
}
