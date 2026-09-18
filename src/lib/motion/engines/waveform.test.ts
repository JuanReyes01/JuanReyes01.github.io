import { describe, it, expect } from 'vitest';
import { WaveformEngine } from './waveform';
import type { Engine } from '../runtime/canvas-action';
import type { Tokens } from '../runtime/tokens';
import type { WaveSignature } from '../fields/waveform';

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

function fakeCanvas(width = 1200, height = 60) {
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

function makeEngine(reduced = false, width = 1200, height = 60) {
	const { canvas, fillTextCallCount, drawn } = fakeCanvas(width, height);
	const engine = new WaveformEngine({ canvas, tokens: TOKENS, reduced, section: 'work' });
	engine.resize();
	return { engine, fillTextCallCount, drawn };
}

describe('WaveformEngine', () => {
	it('draws glyphs to the canvas without throwing', () => {
		const { engine, fillTextCallCount } = makeEngine();
		engine.draw(0);
		expect(fillTextCallCount()).toBeGreaterThan(0);
	});

	it('never settles while ambient (subtle drift is allowed, never fully stops)', () => {
		const { engine } = makeEngine(false);
		expect(engine.isSettled()).toBe(false);
	});

	it('is always settled under reduced motion (one static frame)', () => {
		const { engine } = makeEngine(true);
		expect(engine.isSettled()).toBe(true);
	});

	it('renders a deterministic frame under reduced motion regardless of `now`', () => {
		const { engine: a, drawn: drawnA } = makeEngine(true);
		a.draw(0);
		const { engine: b, drawn: drawnB } = makeEngine(true);
		b.draw(999999);
		expect(drawnB).toEqual(drawnA);
	});

	it('draws at most one glyph per column: draw calls stay tiny, nowhere near cell count', () => {
		const { engine, fillTextCallCount } = makeEngine(false, 1200, 60);
		engine.draw(0);
		// One line trace, batched by (row, color) — a handful of calls at most,
		// not hundreds.
		expect(fillTextCallCount()).toBeGreaterThan(0);
		expect(fillTextCallCount()).toBeLessThan(20);
	});

	it('setSignature() changes the drawn trace (a hovered build genuinely looks different)', () => {
		const { engine: a, drawn: drawnA } = makeEngine(true);
		a.draw(0);
		const traceA = drawnA.map((d) => d.text).join('|');

		const { engine: b, drawn: drawnB } = makeEngine(true);
		const distinctSignature: WaveSignature = { amplitude: 0.8, frequency: 4, waveCount: 4 };
		b.setSignature(distinctSignature);
		b.draw(0);
		const traceB = drawnB.map((d) => d.text).join('|');

		expect(traceB).not.toBe(traceA);
	});

	it('resetSignature() returns to the default trace after a signature change', () => {
		const { engine, drawn } = makeEngine(true);
		engine.draw(0);
		const original = drawn.map((d) => d.text).join('|');
		drawn.length = 0;

		engine.setSignature({ amplitude: 0.8, frequency: 4, waveCount: 4 });
		engine.draw(0);
		drawn.length = 0;

		engine.resetSignature();
		engine.draw(0);
		expect(drawn.map((d) => d.text).join('|')).toBe(original);
	});

	it('poke() deforms the trace at the same instant without throwing', () => {
		const { engine: unpoked, drawn: drawnA } = makeEngine(false, 1200, 60);
		unpoked.draw(0);
		const before = drawnA.map((d) => d.text).join('|');

		const { engine: poked, drawn: drawnB } = makeEngine(false, 1200, 60);
		expect(() => poked.poke(600, 8)).not.toThrow();
		poked.draw(0);
		const after = drawnB.map((d) => d.text).join('|');

		expect(after).not.toBe(before);
	});

	it('poke() is a no-op under reduced motion (static frame stays static)', () => {
		const { engine, drawn } = makeEngine(true, 1200, 60);
		engine.draw(0);
		const before = drawn.map((d) => d.text).join('|');
		drawn.length = 0;
		engine.poke(600, 8);
		engine.draw(0);
		expect(drawn.map((d) => d.text).join('|')).toBe(before);
	});

	it('setVisibility() is a no-op — the shared scheduler already gates visibility (R1)', () => {
		const { engine } = makeEngine(false);
		expect(() => (engine as Engine).setVisibility(true, 0.6)).not.toThrow();
	});

	it('resize()/draw() do not throw for a zero-width rect (unlaid-out canvas)', () => {
		const { canvas } = fakeCanvas(0, 0);
		const engine = new WaveformEngine({ canvas, tokens: TOKENS, reduced: false, section: 'work' });
		expect(() => engine.resize()).not.toThrow();
		expect(() => engine.draw(0)).not.toThrow();
	});
});
