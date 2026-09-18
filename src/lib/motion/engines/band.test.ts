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

	it('poke() displaces the field at the SAME instant (owner decision: every header gets a pointer/touch ripple)', () => {
		// Two engines, same `now` (0) — the only difference is one is poked
		// before its draw. Isolates poke's displacement from ambient drift.
		const { engine: unpoked, drawn: drawnA } = makeEngine(false, 1280, 260);
		unpoked.draw(0);
		const before = drawnA.map((d) => d.text + '|' + d.color).join('~');

		const { engine: poked, drawn: drawnB } = makeEngine(false, 1280, 260);
		// A large poke, far from the (now much bigger, centered) bird, so the
		// displacement shows up as a real density-ramp rounding change
		// somewhere rather than landing on a cell the bird already owns.
		expect(() => poked.poke(60, 30, 40)).not.toThrow();
		poked.draw(0);
		const after = drawnB.map((d) => d.text + '|' + d.color).join('~');

		expect(after).not.toBe(before);
	});

	it('poke() is a no-op under reduced motion (static frame stays static)', () => {
		const { engine, drawn } = makeEngine(true, 1280, 260);
		engine.draw(0);
		const before = drawn.map((d) => d.text).join('~');
		drawn.length = 0;
		engine.poke(400, 120, 8);
		engine.draw(0);
		expect(drawn.map((d) => d.text).join('~')).toBe(before);
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

	// Owner correction (site/v2-direction slice S3, apply-fix round 1):
	// "ambient fields use the density ramp only" — the iridescent field is
	// procedural noise with no real shape to trace, so it must never
	// produce a directional edge glyph, only density-ramp characters. Uses
	// a very wide canvas so the (centered) bird cannot possibly reach the
	// leftmost columns — slicing just those columns from every drawn row
	// gives a clean field-only sample without needing to distinguish bird
	// vs. field by color (several bird parts share the field's own solid
	// hex ink colors, e.g. green).
	it('never traces a directional edge glyph in the ambient field — density ramp only (bird excluded via a far-left column slice)', () => {
		const { engine, drawn } = makeEngine(false, 4000, 260);
		engine.draw(0);
		const FAR_LEFT_COLS = 80;
		const fieldChars = drawn.map((d) => d.text.slice(0, FAR_LEFT_COLS)).join('');
		const edgeGlyphs = [...fieldChars].filter((c) => '|/\\'.includes(c));
		const densityGlyphs = [...fieldChars].filter((c) => '.·:=+*#%@'.includes(c));
		expect(edgeGlyphs.length).toBe(0);
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

	// Owner correction (site/v2-direction slice S3, apply-fix round 1):
	// "the bird is the star of /field/ and it is far too small... make it
	// dominate that header." At a wide/short header aspect ratio, a bird
	// this size legitimately bleeds past the top/bottom edge (like a photo
	// crop) — these tests check that it's centered and meaningfully bigger
	// than before, and that the CORE recognizable silhouette (body, head,
	// wing, gorget — not the outermost flower-stem tip) stays visible,
	// rather than requiring the entire bbox (flower included) to fit with
	// zero clipping, which is what made it small in the first place.
	it('is roughly 2-3x the size of the original 0.45-coefficient scale', () => {
		const ORIGINAL_COEFFICIENT = 0.45;
		const { S } = computeBirdAnchor(1280, 300);
		expect(S).toBeGreaterThan(300 * ORIGINAL_COEFFICIENT * 1.2);
	});

	// Coordinator correction, round 2 (screenshot review): the header's
	// title card (AsciiHeaderFrame) is anchored top-left and occupies
	// roughly the left third of the frame — centering the bird at the
	// frame's literal midpoint put its flower right behind the title's
	// veil. The bird composition now centers in the OPEN space to the
	// right of the title instead, vertically centered in the full frame.
	it("centers the bird bounding box (flower included) in the open space right of the header title, not the frame's literal midpoint", () => {
		const width = 1280;
		const height = 300;
		const { S, ax, ay } = computeBirdAnchor(width, height);
		// bbox midpoint (fields/bird.ts bounds: x in [-1.45,0.88], y in [-0.9,1.02]).
		const bboxMidX = ax + ((0.88 + -1.45) / 2) * S;
		const bboxMidY = ay + ((1.02 + -0.9) / 2) * S;
		expect(bboxMidX).toBeGreaterThan(width * 0.55);
		expect(bboxMidX).toBeCloseTo(width * 0.7, 0);
		expect(bboxMidY).toBeCloseTo(height / 2, 0);
	});

	it('keeps the recognizable core (body/head/wing/gorget, not the flower-stem tip) inside the frame at a realistic desktop size', () => {
		const width = 1280;
		const height = 300;
		const { S, ax, ay } = computeBirdAnchor(width, height);
		// A tighter box than the full bbox — body+head+wing+gorget+beak,
		// excludes the flower/stem's own outer reach (x < -1.0).
		expect(ax + -0.75 * S).toBeGreaterThan(-width * 0.05);
		expect(ax + 0.88 * S).toBeLessThan(width * 1.05);
		expect(ay + -0.55 * S).toBeGreaterThan(-height * 0.05);
		expect(ay + 0.75 * S).toBeLessThan(height * 1.05);
	});

	// Coordinator correction: "obvious at a glance, at 1280px AND at 400px."
	// The composition's rightward shift (clearing the header title's
	// top-left card) has plenty of room at desktop widths, but a narrow
	// mobile header doesn't have 70% + half the bird's own width to spare —
	// without a cap, the bird's right wing bled off the frame entirely.
	it('keeps the bird on-screen at a narrow (mobile) header size, even though the desktop composition shifts it rightward', () => {
		const width = 400;
		const height = 180;
		const { S, ax } = computeBirdAnchor(width, height);
		expect(ax + 0.88 * S).toBeLessThan(width * 1.02);
		expect(ax + -1.45 * S).toBeLessThan(width);
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
