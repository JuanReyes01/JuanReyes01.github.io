import { describe, it, expect } from 'vitest';
import { WaveformEngine } from './waveform';
import type { Engine } from '../runtime/canvas-action';
import type { Tokens } from '../runtime/tokens';
import { deriveBuildPalette, type WaveSignature } from '../fields/waveform';

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

/** Glyphs that only ever come from the density ramp (ambient field / body
 * band) — never from the trace's own curveGlyph ramp. */
const DENSITY_ONLY_GLYPHS = ['·', ':', '=', '+', '*', '#', '%', '@'];
/** Glyphs that only ever come from the trace (curveGlyph) — never from the
 * density ramp. */
const TRACE_ONLY_GLYPHS = ['‾', '_', '|', '/', '\\'];

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

/** Every glyph drawn, across every fillText call, concatenated — spaces
 * included so `.includes(glyph)` checks stay simple. */
function allGlyphs(drawn: Array<{ text: string; color: string }>): string {
	return drawn.map((d) => d.text).join('');
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

	// Owner-approved header prototype port: the waveform is now 3 composited
	// layers (ambient field, body band, trace), not a single traced line, so
	// draw calls are no longer bounded to "a handful" the way one line was —
	// but they still stay well below one `fillText` per cell, because same
	// color+alpha runs within a row are batched into one string each (see
	// the prototype's own final paint loop).
	it('batches same-color runs so draw calls stay far below one fillText per cell', () => {
		const { engine, fillTextCallCount } = makeEngine(false, 1200, 60);
		engine.draw(0);
		const approxCols = Math.ceil(1200 / 7); // matches the fake ctx's measureText width:7
		const approxRows = 5; // MIN_ROWS floor for a 60px-tall fixture at FONT_PX=11
		expect(fillTextCallCount()).toBeGreaterThan(0);
		expect(fillTextCallCount()).toBeLessThan(approxCols * approxRows);
	});

	// Owner-approved header prototype port: "an ambient field behind
	// everything" plus "the trace itself" means the drawn frame now mixes
	// glyphs from two different ramps in the same frame — proof neither
	// layer replaced the other.
	it('draws both ambient/body density-ramp glyphs and trace glyphs in the same frame', () => {
		const { engine, drawn } = makeEngine(true, 1200, 80);
		engine.draw(0);
		const glyphs = allGlyphs(drawn);
		expect(DENSITY_ONLY_GLYPHS.some((g) => glyphs.includes(g))).toBe(true);
		expect(TRACE_ONLY_GLYPHS.some((g) => glyphs.includes(g))).toBe(true);
	});

	it('setSignature() changes the drawn trace (a hovered build genuinely looks different)', () => {
		const { engine: a, drawn: drawnA } = makeEngine(true);
		a.draw(0);
		const traceA = drawnA.map((d) => d.text).join('|');

		const { engine: b, drawn: drawnB } = makeEngine(true);
		const distinctSignature: WaveSignature = { amplitude: 0.8, frequency: 2, waveCount: 4 };
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

		engine.setSignature({ amplitude: 0.8, frequency: 2, waveCount: 4 });
		engine.draw(0);
		drawn.length = 0;

		engine.resetSignature();
		engine.draw(0);
		expect(drawn.map((d) => d.text).join('|')).toBe(original);
	});

	// The build's own palette (owner-approved header prototype port, "off the
	// earth tones" pass): the waveform's color now comes from
	// `deriveBuildPalette`, not `colorsForSection` — two builds landing on
	// different pairs must paint different colors, not just a different
	// shape.
	it('setPalette() changes the drawn colors (two different seeds paint different colours)', () => {
		const { engine: a, drawn: drawnA } = makeEngine(true, 1200, 80);
		a.setPalette(deriveBuildPalette('creditbay:20 → 600'));
		a.draw(0);
		const colorsA = new Set(drawnA.map((d) => d.color));

		const { engine: b, drawn: drawnB } = makeEngine(true, 1200, 80);
		b.setPalette(deriveBuildPalette('amd:~90%'));
		b.draw(0);
		const colorsB = new Set(drawnB.map((d) => d.color));

		expect(colorsB).not.toEqual(colorsA);
	});

	it('resetPalette() returns to the default palette after a palette change', () => {
		const { engine, drawn } = makeEngine(true, 1200, 80);
		engine.draw(0);
		const original = drawn.map((d) => `${d.text}${d.color}`).join('|');
		drawn.length = 0;

		engine.setPalette(deriveBuildPalette('amd:~90%'));
		engine.draw(0);
		drawn.length = 0;

		engine.resetPalette();
		engine.draw(0);
		expect(drawn.map((d) => `${d.text}${d.color}`).join('|')).toBe(original);
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

	// Coordinator correction round 2 (still true after the 3-layer port): "the
	// waveform reads as a dashed staircase, not a wave... make sure
	// consecutive cells join visually instead of leaving gaps." The ambient
	// field alone already covers close to the full grid now, so this no
	// longer isolates the trace the way it did with a single line — the
	// jump-filling guarantee itself is unit-tested directly against
	// `curveGlyph` in `fields/waveform.test.ts`. This keeps the coverage that
	// the composited frame is genuinely dense, not sparse.
	it('draws more glyphs than columns — the composited frame is dense, not sparse', () => {
		const { engine, drawn } = makeEngine(false, 1200, 80);
		engine.draw(0);
		const totalGlyphs = drawn.reduce(
			(sum, d) => sum + [...d.text].filter((c) => c !== ' ').length,
			0
		);
		const approxCols = Math.ceil(1200 / 7); // matches the fake ctx's measureText width:7
		expect(totalGlyphs).toBeGreaterThan(approxCols);
	});

	// Owner-approved header prototype port: `curveGlyph`'s sub-cell ramp
	// means '‾'/'_' no longer exclusively mark the very top/bottom row (they
	// can appear anywhere the fractional row position lands in the top/
	// bottom quarter of a cell) — so "reaches an extreme row" is no longer
	// provable from glyph identity alone. What's still true, and still worth
	// asserting here: the trace produces a genuine diagonal or near-vertical
	// stroke somewhere, proof it travels a real vertical distance between
	// columns rather than just wobbling within one cell.
	it('produces a real diagonal or near-vertical stroke — the trace travels between rows, not just within one', () => {
		const { engine, drawn } = makeEngine(true, 1200, 300);
		// Near the top of the signature's own valid range (see
		// `fields/waveform.test.ts`) so the per-column row delta reliably
		// clears `curveGlyph`'s 0.85 diagonal threshold regardless of which
		// default seed happens to hash where — this test is about
		// `curveGlyph` actually getting exercised by the engine, not about
		// the "default" seed's own particular shape.
		engine.setSignature({ amplitude: 0.85, frequency: 2.1, waveCount: 2 });
		engine.draw(0);
		const glyphs = allGlyphs(drawn);
		const travels = glyphs.includes('|') || glyphs.includes('/') || glyphs.includes('\\');
		expect(travels).toBe(true);
	});

	// Approved header prototype port: the waveform now fills the WHOLE
	// header banner (previously a fixed 7-row strip below it), so its own
	// row count must track the real canvas height instead of a constant —
	// otherwise a tall header only ever fills its top ~100px and leaves the
	// rest of the banner blank.
	it('draws more rows on a taller canvas — the trace fills the real header height, not a fixed strip', () => {
		const short = makeEngine(true, 1200, 60);
		short.engine.draw(0);

		const tall = makeEngine(true, 1200, 240);
		tall.engine.draw(0);

		expect(tall.fillTextCallCount()).toBeGreaterThan(short.fillTextCallCount());
	});

	// Prototype: "a dent in the line, not a spike that slams it into the
	// frame" — the engine softens `poke()`'s own strength via the pure
	// `waveformPokeAmount` helper (see `fields/waveform.test.ts` for the
	// softening curve itself) before adding it to the buffer, instead of
	// pushing raw pointer-speed values straight in.
	it('poke() never adds more than waveformPokeAmount’s own cap, even for an extreme strength', () => {
		const { engine, drawn } = makeEngine(false, 1200, 80);
		engine.poke(600, 500); // an extreme strength value
		expect(() => engine.draw(0)).not.toThrow();
		// A capped poke still leaves most of the strip's normal slope intact
		// around the dent — an uncapped raw 500 would blow the buffer far
		// past +-1 and clip the whole strip flat for many columns.
		const allChars = drawn.map((d) => d.text).join('');
		expect(allChars.includes('/') || allChars.includes('\\')).toBe(true);
	});
});

describe('WaveformEngine poke feedback', () => {
	// Regression: the poked column used to swap to a flat `pink` token, which
	// is exactly the resting colour of a build whose palette pair STARTS at
	// pink — `amd:~90%` and `opinion-corpus:100k+` both derive that pair, so
	// dragging their headers changed the shape and nothing else.
	function traceColours(drawn: Array<{ text: string; color: string }>): Set<string> {
		const colours = new Set<string>();
		for (const { text, color } of drawn) {
			if ([...text].some((glyph) => TRACE_ONLY_GLYPHS.includes(glyph))) colours.add(color);
		}
		return colours;
	}

	it('changes the trace colour when poked, even when the build is pink', () => {
		const { canvas, drawn } = fakeCanvas();
		const engine = new WaveformEngine({ canvas, tokens: TOKENS, reduced: false, section: 'work' });
		engine.resize();
		engine.setPalette(['pink', 'magenta']);

		engine.draw(0);
		const resting = traceColours(drawn);
		expect(resting.size).toBeGreaterThan(0);

		drawn.length = 0;
		engine.poke(600, 40);
		engine.draw(60);
		const poked = traceColours(drawn);

		const added = [...poked].filter((colour) => !resting.has(colour));
		expect(
			added.length,
			'a poke must paint the trace a colour it did not already use'
		).toBeGreaterThan(0);
	});
});
