import { describe, it, expect } from 'vitest';
import { SkyEngine, type MeasurableElement } from './sky';
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

function rect(overrides: Partial<ReturnType<MeasurableElement['getBoundingClientRect']>> = {}) {
	return { top: 0, left: 0, width: 0, height: 0, ...overrides };
}

function fakeCanvas(width = 600, height = 300) {
	const ctx = {
		fillStyle: '',
		font: '',
		textBaseline: '',
		setTransform: () => {},
		clearRect: () => {},
		fillText: () => {
			fillTextCalls++;
		},
		measureText: () => ({ width: 7 })
	};
	let fillTextCalls = 0;
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => ctx,
		getBoundingClientRect: () => rect({ width, height })
	};
	return {
		canvas: canvas as unknown as HTMLCanvasElement,
		ctx,
		fillTextCallCount: () => fillTextCalls
	};
}

function makeEngine(reduced: boolean, width = 600, height = 300) {
	const { canvas, fillTextCallCount } = fakeCanvas(width, height);
	const host: MeasurableElement = {
		getBoundingClientRect: () => rect({ width, height })
	};
	const textEl: MeasurableElement = {
		getBoundingClientRect: () => rect({ left: 20, width: 200 })
	};
	const engine = new SkyEngine({ canvas, host, textEl, spaceEl: null, tokens: TOKENS, reduced });
	engine.resize();
	return { engine, fillTextCallCount };
}

describe('SkyEngine', () => {
	it('never settles while ambient (visible, not reduced)', () => {
		const { engine } = makeEngine(false);
		expect(engine.isSettled()).toBe(false);
	});

	it('is always settled under reduced motion (one static frame)', () => {
		const { engine } = makeEngine(true);
		expect(engine.isSettled()).toBe(true);
	});

	it('draws glyphs to the canvas without throwing', () => {
		const { engine, fillTextCallCount } = makeEngine(false);
		engine.draw(0);
		expect(fillTextCallCount()).toBeGreaterThan(0);
	});

	it('renders a deterministic frame under reduced motion regardless of `now`', () => {
		const { engine: a, fillTextCallCount: countA } = makeEngine(true);
		a.draw(0);
		const first = countA();
		const { engine: b, fillTextCallCount: countB } = makeEngine(true);
		b.draw(999999);
		expect(countB()).toBe(first);
	});

	it('setVisibility() is a no-op — the shared scheduler already gates visibility (R1)', () => {
		const { engine } = makeEngine(false);
		expect(() => (engine as Engine).setVisibility(true, 0.6)).not.toThrow();
		expect(engine.isSettled()).toBe(false); // unaffected either way
	});

	it('batches draws per row and color key: fillText calls stay bounded by rows × distinct colors, not cell count (E4)', () => {
		const { engine, fillTextCallCount } = makeEngine(false, 1200, 400);
		engine.draw(0);
		// Legacy Sky.prototype.draw batches one string per row per color key
		// (one fillStyle + one fillText per batch). A 1200x400 hero has ~170
		// cols x ~29 rows (~4900 non-space cells) but only a handful of
		// distinct color keys per row, so a properly batched frame draws far
		// fewer than 300 times — one fillText per cell would blow well past it.
		expect(fillTextCallCount()).toBeGreaterThan(0);
		expect(fillTextCallCount()).toBeLessThan(300);
	});

	it('poke() and setReduced() do not throw', () => {
		const { engine } = makeEngine(false);
		engine.draw(0);
		expect(() => engine.poke(100, 100, 5)).not.toThrow();
		expect(() => engine.setReduced(true)).not.toThrow();
		expect(() => engine.draw(16)).not.toThrow();
	});
});
