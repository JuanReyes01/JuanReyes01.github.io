import { describe, it, expect } from 'vitest';
import { BandEngine, computeBirdAnchor, birdSpaceOf } from './band';
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

/** Same convention as `sky.test.ts`'s fake canvas: `fillText` counts calls;
 * `fillTextCapturing` also records the (text, color) pair drawn. */
function fakeCanvas(width = 900, height = 258) {
	const drawn: Array<{ text: string; color: string }> = [];
	let fillTextCalls = 0;
	const ctx = {
		fillStyle: '',
		font: '',
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

function makeEngine(reduced: boolean, width = 900, height = 258) {
	const { canvas, fillTextCallCount, drawn } = fakeCanvas(width, height);
	const engine = new BandEngine({ canvas, tokens: TOKENS, reduced });
	engine.resize();
	return { engine, fillTextCallCount, drawn };
}

describe('BandEngine (character field)', () => {
	it('draws glyphs to the canvas without throwing', () => {
		const { engine, fillTextCallCount } = makeEngine(false);
		engine.draw(0);
		expect(fillTextCallCount()).toBeGreaterThan(0);
	});

	it('never settles while ambient (visible, not reduced)', () => {
		const { engine } = makeEngine(false);
		expect(engine.isSettled()).toBe(false);
	});

	it('is always settled under reduced motion (one static frame)', () => {
		const { engine } = makeEngine(true);
		expect(engine.isSettled()).toBe(true);
	});

	it('setVisibility() is a no-op — the shared scheduler already gates visibility (R1)', () => {
		const { engine } = makeEngine(false);
		expect(() => (engine as Engine).setVisibility(true, 0.6)).not.toThrow();
		expect(engine.isSettled()).toBe(false);
	});

	it('renders a deterministic frame under reduced motion regardless of `now`', () => {
		const { engine: a, drawn: drawnA } = makeEngine(true);
		a.draw(0);
		const { engine: b, drawn: drawnB } = makeEngine(true);
		b.draw(999999);
		expect(drawnB.map((d) => d.text + '|' + d.color)).toEqual(
			drawnA.map((d) => d.text + '|' + d.color)
		);
	});

	it('batches draws per row and color key: fillText calls stay far below cell count (E4)', () => {
		const { engine, fillTextCallCount } = makeEngine(false, 1280, 260);
		engine.draw(0);
		// A dense character field still batches by (row, color) — bounded well
		// under one call per cell.
		expect(fillTextCallCount()).toBeGreaterThan(0);
		expect(fillTextCallCount()).toBeLessThan(600);
	});

	it('traces field edges with directional glyphs and keeps flat interiors on the density ramp', () => {
		const { engine, drawn } = makeEngine(false, 1280, 260);
		engine.draw(0);
		const allChars = drawn.map((d) => d.text).join('');
		const edgeGlyphs = [...allChars].filter((c) => '|/\\'.includes(c));
		const densityGlyphs = [...allChars].filter((c) => '.·:=+*#%@'.includes(c));
		expect(edgeGlyphs.length).toBeGreaterThan(0);
		expect(densityGlyphs.length).toBeGreaterThan(0);
	});

	describe('the hummingbird, drawn with characters (owner verdict: "the bird looks wrong")', () => {
		it('draws the gorget in a pink/magenta color the ambient field never produces (green/cyan/blue only) — proving the bird is actually composited in', () => {
			const { engine, drawn } = makeEngine(false, 900, 258);
			engine.draw(0);
			const colorsUsed = new Set(drawn.map((d) => d.color));
			expect(colorsUsed.has(TOKENS.pink) || colorsUsed.has(TOKENS.magenta)).toBe(true);
		});

		it('traces the bird silhouette boundary with directional edge glyphs, not just its density ramp', () => {
			const { engine, drawn } = makeEngine(false, 900, 258);
			engine.draw(0);
			// Cells painted in a bird-only color (wing/ghost/farwing are
			// rgba(...) mixes of `muted`/`fg2` — distinct from the field's flat
			// hex inks) must include at least one directional edge glyph.
			const birdColored = drawn.filter((d) => d.color.startsWith('rgba('));
			expect(birdColored.length).toBeGreaterThan(0);
			const birdChars = birdColored.map((d) => d.text).join('');
			const edgeGlyphs = [...birdChars].filter((c) => '|/\\'.includes(c));
			expect(edgeGlyphs.length).toBeGreaterThan(0);
		});

		it('keeps rendering deterministically under reduced motion with the bird composited in', () => {
			const { engine: a, drawn: drawnA } = makeEngine(true);
			a.draw(0);
			const { engine: b, drawn: drawnB } = makeEngine(true);
			b.draw(999999);
			expect(drawnB).toEqual(drawnA);
		});
	});

	it('resize()/draw() do not throw for a zero-width rect (unlaid-out canvas)', () => {
		const { canvas } = fakeCanvas(0, 0);
		const engine = new BandEngine({ canvas, tokens: TOKENS, reduced: false });
		expect(() => engine.resize()).not.toThrow();
		expect(() => engine.draw(0)).not.toThrow();
	});
});

describe('computeBirdAnchor (physical pixels, not grid cells)', () => {
	it('scales the bird from the band size in real pixels, not a fixed size', () => {
		const small = computeBirdAnchor(400, 160);
		const big = computeBirdAnchor(800, 320);
		expect(big.S).toBeCloseTo(small.S * 2);
		expect(big.ax).toBeCloseTo(small.ax * 2);
		expect(big.ay).toBeCloseTo(small.ay * 2);
	});

	it('keeps the whole hummingbird (including the flower) inside the band at a realistic desktop size', () => {
		const width = 1280;
		const height = 258;
		const { S, ax, ay } = computeBirdAnchor(width, height);
		// sampleBird's own bounding box (fields/bird.ts): x in [-1.45, 0.88], y in [-0.9, 1.02].
		expect(ax + -1.45 * S).toBeGreaterThan(0);
		expect(ax + 0.88 * S).toBeLessThan(width);
		expect(ay + -0.9 * S).toBeGreaterThan(0);
		expect(ay + 1.02 * S).toBeLessThan(height);
	});

	it('keeps the bird comfortably inside the band at a narrow (mobile) size too', () => {
		const width = 400;
		const height = 160;
		const { S, ax, ay } = computeBirdAnchor(width, height);
		expect(ax + -1.45 * S).toBeGreaterThan(0);
		expect(ax + 0.88 * S).toBeLessThan(width);
		expect(ay + -0.9 * S).toBeGreaterThan(0);
		expect(ay + 1.02 * S).toBeLessThan(height);
	});
});

describe('birdSpaceOf', () => {
	const anchor = { S: 100, ax: 500, ay: 130 };

	it('maps the anchor point itself to bird-space origin', () => {
		expect(birdSpaceOf(anchor.ax, anchor.ay, anchor)).toEqual({ bx: 0, by: 0 });
	});

	it('maps one S away on each physical axis to one bird-space unit, independent of font aspect ratio', () => {
		expect(birdSpaceOf(anchor.ax + anchor.S, anchor.ay, anchor)).toEqual({ bx: 1, by: 0 });
		expect(birdSpaceOf(anchor.ax, anchor.ay + anchor.S, anchor)).toEqual({ bx: 0, by: 1 });
		expect(birdSpaceOf(anchor.ax - anchor.S * 2, anchor.ay, anchor)).toEqual({ bx: -2, by: 0 });
	});
});
