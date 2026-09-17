import { describe, it, expect } from 'vitest';
import { SkyEngine } from './sky';
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

function rect(
	overrides: Partial<{ top: number; left: number; width: number; height: number }> = {}
) {
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
	const engine = new SkyEngine({ canvas, tokens: TOKENS, reduced });
	engine.resize();
	return { engine, fillTextCallCount };
}

/** Like {@link fakeCanvas}, but also captures every string drawn so a test
 * can inspect which glyphs actually got painted (owner decision #4938 item
 * 6: directional edge glyphs, not just the flat density ramp). */
function fakeCanvasCapturingText(width = 600, height = 300) {
	const drawn: string[] = [];
	const ctx = {
		fillStyle: '',
		font: '',
		textBaseline: '',
		setTransform: () => {},
		clearRect: () => {},
		fillText: (text: string) => {
			drawn.push(text);
		},
		measureText: () => ({ width: 7 })
	};
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => ctx,
		getBoundingClientRect: () => rect({ width, height })
	};
	return { canvas: canvas as unknown as HTMLCanvasElement, drawn };
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

	// design #4938 slice S2: the hummingbird (and its host/textEl-dependent
	// layout math) moved to `/field/` — this engine is cloud+ripple only now,
	// so resize()/draw() no longer take or need any DOM-measurement params.
	it('resize()/draw() do not throw for a zero-width rect (still guards a genuinely unlaid-out canvas)', () => {
		const { canvas } = fakeCanvas(0, 0);
		const engine = new SkyEngine({ canvas, tokens: TOKENS, reduced: false });
		expect(() => engine.resize()).not.toThrow();
		expect(() => engine.draw(0)).not.toThrow();
	});

	// design #4938 item 6: "the theme is ASCII ART, but super advanced" —
	// the cloud field must trace its shapes with directional edge glyphs
	// (`- | / \`), not just a flat brightness -> density ramp, while flat
	// interiors keep the density ramp (no noisy edge glyphs everywhere).
	it('paints directional edge glyphs at cloud boundaries, not just density-ramp characters', () => {
		const { canvas, drawn } = fakeCanvasCapturingText(1200, 400);
		const engine = new SkyEngine({ canvas, tokens: TOKENS, reduced: false });
		engine.resize();
		engine.draw(0);
		const allChars = drawn.join('');
		// `|`, `/`, `\` are NOT part of the legacy density ramp (` .·:-=+*#%@`
		// already contains `-`), so finding any of them proves real
		// directional-glyph selection kicked in, not just a density lookup.
		const edgeGlyphs = [...allChars].filter((c) => '|/\\'.includes(c));
		expect(edgeGlyphs.length).toBeGreaterThan(0);
		// Interiors must still fall back to the density ramp somewhere — the
		// upgrade traces edges, it doesn't turn the whole field into edges.
		const densityGlyphs = [...allChars].filter((c) => '.·:=+*#%@'.includes(c));
		expect(densityGlyphs.length).toBeGreaterThan(0);
	});

	it('keeps the reduced-motion static frame deterministic with the new glyph selection', () => {
		const { canvas, drawn } = fakeCanvasCapturingText(1200, 400);
		const engine = new SkyEngine({ canvas, tokens: TOKENS, reduced: true });
		engine.resize();
		engine.draw(0);
		const first = drawn.join('|');
		const { canvas: canvas2, drawn: drawn2 } = fakeCanvasCapturingText(1200, 400);
		const engine2 = new SkyEngine({ canvas: canvas2, tokens: TOKENS, reduced: true });
		engine2.resize();
		engine2.draw(50000);
		expect(drawn2.join('|')).toBe(first);
	});
});
