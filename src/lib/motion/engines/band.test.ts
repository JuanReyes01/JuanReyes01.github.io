import { describe, it, expect } from 'vitest';
import { BandEngine } from './band';
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

function makeEngine(reduced: boolean, width = 900) {
	const { canvas, putCount, lastImage } = fakeCanvas(width);
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
});
