import { describe, it, expect } from 'vitest';
import { BandEngine, computeBirdAnchor } from './band';
import { hexToRgb } from '../runtime/tokens';
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

function fakeCanvas(width = 900, height = 140) {
	let putCount = 0;
	let lastImage: ImageData | null = null;
	const ctx = {
		createImageData: (w: number, h: number) =>
			({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) as ImageData,
		putImageData: (image: ImageData) => {
			putCount++;
			lastImage = image;
		}
	};
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => ctx,
		getBoundingClientRect: () => ({ width, height, top: 0, left: 0, right: width, bottom: height })
	};
	return {
		canvas: canvas as unknown as HTMLCanvasElement,
		putCount: () => putCount,
		lastImage: () => lastImage
	};
}

function makeEngine(reduced: boolean, width = 900, height = 140) {
	const { canvas, putCount, lastImage } = fakeCanvas(width, height);
	const engine = new BandEngine({ canvas, tokens: TOKENS, reduced });
	engine.resize();
	return { engine, putCount, lastImage };
}

describe('BandEngine', () => {
	it('downscales to a 3px dither cell on desktop widths', () => {
		const { engine, lastImage } = makeEngine(false, 900);
		engine.draw(0);
		expect(lastImage()?.width).toBe(Math.floor(900 / 3));
	});

	it('downscales to a 2px dither cell at or below the 760px breakpoint', () => {
		const { engine, lastImage } = makeEngine(false, 600);
		engine.draw(0);
		expect(lastImage()?.width).toBe(Math.floor(600 / 2));
	});

	it('paints the dithered image without throwing', () => {
		const { engine, putCount } = makeEngine(false);
		engine.draw(0);
		expect(putCount()).toBe(1);
	});

	it('never settles while ambient (visible, not reduced)', () => {
		const { engine } = makeEngine(false);
		expect(engine.isSettled()).toBe(false);
	});

	it('setVisibility() is a no-op — the shared scheduler already gates visibility (R1)', () => {
		const { engine } = makeEngine(false);
		expect(() => (engine as Engine).setVisibility(true, 0.6)).not.toThrow();
		expect(engine.isSettled()).toBe(false); // unaffected either way
	});

	it('is always settled under reduced motion (one static frame)', () => {
		const { engine } = makeEngine(true);
		expect(engine.isSettled()).toBe(true);
	});

	it('renders a deterministic frame under reduced motion regardless of `now`', () => {
		const { engine: a, lastImage: imageA } = makeEngine(true);
		a.draw(0);
		const { engine: b, lastImage: imageB } = makeEngine(true);
		b.draw(999999);
		expect(Array.from(imageB()!.data)).toEqual(Array.from(imageA()!.data));
	});

	it('lights only some pixels (ordered dither leaves gaps, not a solid fill)', () => {
		const { engine, lastImage } = makeEngine(false);
		engine.draw(0);
		const data = lastImage()!.data;
		let lit = 0;
		let dark = 0;
		for (let i = 3; i < data.length; i += 4) {
			if (data[i] > 0) lit++;
			else dark++;
		}
		expect(lit).toBeGreaterThan(0);
		expect(dark).toBeGreaterThan(0);
	});

	// design #4938 slice S2: the hummingbird moves from the hero to `/field/`,
	// drawn directly into the band's own grid so band + bird share one canvas.
	describe('the hummingbird (design #4938 slice S2)', () => {
		it('draws a gorget pixel — pink/magenta, colors the ambient iridescent field never produces (only green/cyan/blue inks) — proving the bird is actually composited in', () => {
			const { engine, lastImage } = makeEngine(false, 900);
			engine.draw(0);
			const data = lastImage()!.data;
			const [pr, pg, pb] = hexToRgb(TOKENS.pink);
			const [mr, mg, mb] = hexToRgb(TOKENS.magenta);
			let found = false;
			for (let i = 0; i < data.length; i += 4) {
				const isPink = data[i] === pr && data[i + 1] === pg && data[i + 2] === pb;
				const isMagenta = data[i] === mr && data[i + 1] === mg && data[i + 2] === mb;
				if ((isPink || isMagenta) && data[i + 3] === 255) {
					found = true;
					break;
				}
			}
			expect(found).toBe(true);
		});

		it('keeps rendering deterministically under reduced motion with the bird composited in', () => {
			const { engine: a, lastImage: imageA } = makeEngine(true);
			a.draw(0);
			const { engine: b, lastImage: imageB } = makeEngine(true);
			b.draw(999999);
			expect(Array.from(imageB()!.data)).toEqual(Array.from(imageA()!.data));
		});

		// design #4938 item 6 ("the theme is ASCII ART, but super advanced"):
		// the band is a raw pixel/dither raster (one canvas pixel per dither
		// cell — too fine for legible text glyphs), so "shapes read as drawn"
		// here means the SAME gradient technique the directional-glyph engine
		// uses (fields/glyphs.ts's sampleGradient), applied to force a crisp,
		// fully-opaque outline right at the bird's own silhouette boundary,
		// instead of leaving translucent wing/farwing/ghost parts to fade
		// into whatever partial alpha the dither field underneath happened
		// to leave. Coordinates below were found by scanning this exact
		// deterministic reduced-motion frame (900x258 -> 300x86 grid, seedT
		// 4.2) for a real silhouette-edge cell and a real deep-interior
		// translucent cell, so this is a genuine behavioral assertion, not a
		// tautology.
		it('outlines the bird silhouette: a translucent wing cell right at the edge (adjacent to true exterior) renders fully opaque', () => {
			const { engine, lastImage } = makeEngine(true, 900, 258);
			engine.draw(0);
			const data = lastImage()!.data;
			const width = lastImage()!.width;
			const i = (35 * width + 194) * 4;
			expect(data[i + 3]).toBe(255);
		});

		it('keeps a deep-interior translucent cell (no adjacent exterior) at its natural partial alpha — the boost only fires at real edges', () => {
			const { engine, lastImage } = makeEngine(true, 900, 258);
			engine.draw(0);
			const data = lastImage()!.data;
			const width = lastImage()!.width;
			const i = (19 * width + 203) * 4;
			expect(data[i + 3]).toBe(115);
		});
	});
});

describe('computeBirdAnchor', () => {
	it('scales the bird from the band size, not a fixed pixel size', () => {
		const small = computeBirdAnchor(100, 40);
		const big = computeBirdAnchor(200, 80);
		expect(big.S).toBeCloseTo(small.S * 2);
		expect(big.ax).toBeCloseTo(small.ax * 2);
		expect(big.ay).toBeCloseTo(small.ay * 2);
	});

	it('keeps the whole hummingbird (including the flower, its leftmost/lowest reach) inside the grid at a realistic band size', () => {
		const cols = 400;
		const rows = 86;
		const { S, ax, ay } = computeBirdAnchor(cols, rows);
		// sampleBird's own early-exit bounding box (fields/bird.ts): x in
		// [-1.45, 0.88], y in [-0.9, 1.02] — the true bird+flower extent.
		expect(ax + -1.45 * S).toBeGreaterThan(0);
		expect(ax + 0.88 * S).toBeLessThan(cols);
		expect(ay + -0.9 * S).toBeGreaterThan(0);
		expect(ay + 1.02 * S).toBeLessThan(rows);
	});

	it('keeps the bird comfortably inside the grid at a narrow (mobile) band size too', () => {
		const cols = 200;
		const rows = 80;
		const { S, ax, ay } = computeBirdAnchor(cols, rows);
		expect(ax + -1.45 * S).toBeGreaterThan(0);
		expect(ax + 0.88 * S).toBeLessThan(cols);
		expect(ay + -0.9 * S).toBeGreaterThan(0);
		expect(ay + 1.02 * S).toBeLessThan(rows);
	});
});
