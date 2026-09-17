import { describe, it, expect, vi } from 'vitest';
import { TimelineEngine } from './timeline';
import { parseMonth } from '../../domain/month';
import type { Timeline } from '../../domain/types';
import type { Readout } from '../../domain/readout';
import type { Tokens } from '../runtime/tokens';

const TOKENS: Tokens = {
	bg: '#000',
	banner: '#001',
	fg: '#fff',
	fg2: '#eee',
	muted: '#888',
	line: '#333',
	cyan: '#0ff',
	magenta: '#f0f',
	yellow: '#ff0',
	green: '#0f0',
	blue: '#00f',
	pink: '#f88'
};

// `epoch` is a REAL calendar month (like the site's actual content), not a
// naive 0..10 fixture — an `epoch: 0` fixture would silently pass even if
// the engine hardcoded "the start" as literal `0` instead of
// `timeline.epoch`. `Month` is absolute (`year*12+(month-1)`, design D1),
// so `0` means "January, year 0", not "the start of the timeline" — that
// exact bug made `readoutAt` format an invalid `"0-01"` date and crash
// `parseMonth` (which requires a 4-digit year) on every real page load.
const EPOCH = parseMonth('2019-08');
const LAST = EPOCH + 10;
const TIMELINE: Timeline = {
	epoch: EPOCH,
	last: LAST,
	lanes: [
		{
			id: 'a',
			label: 'Alpha lane',
			short: 'A',
			color: 'cyan',
			m0: EPOCH,
			m1: LAST,
			row: 4,
			head: true
		}
	],
	events: [
		{ m: EPOCH, lane: 'a', text: 'Started' },
		{ m: EPOCH + 5, lane: 'a', text: 'Milestone' }
	]
};

function fakeCanvas(width = 900) {
	const ctx = {
		fillStyle: '',
		globalAlpha: 1,
		font: '',
		textBaseline: '',
		textAlign: '',
		shadowColor: '',
		shadowBlur: 0,
		setTransform: vi.fn(),
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		fillText: vi.fn(),
		measureText: () => ({ width: 7 })
	};
	const canvas = {
		style: {} as Record<string, string>,
		width: 0,
		height: 0,
		getContext: () => ctx,
		getBoundingClientRect: () => ({
			width,
			height: 0,
			top: 0,
			left: 0,
			right: width,
			bottom: 0,
			x: 0,
			y: 0
		})
	};
	return { canvas: canvas as unknown as HTMLCanvasElement, ctx };
}

function makeEngine(
	overrides: Partial<{
		reduced: boolean;
		onReadout: ReturnType<typeof vi.fn<(readout: Readout) => void>>;
	}> = {}
) {
	const { canvas, ctx } = fakeCanvas();
	const wake = vi.fn();
	const onReadout = overrides.onReadout ?? vi.fn<(readout: Readout) => void>();
	const engine = new TimelineEngine({
		canvas,
		timeline: TIMELINE,
		tokens: TOKENS,
		reduced: overrides.reduced ?? false,
		now: () => 0,
		wake,
		onReadout
	});
	engine.resize();
	return { engine, ctx, wake, onReadout };
}

describe('TimelineEngine', () => {
	it('renders one fully-settled static frame at HEAD under reduced motion (spec: reduced motion is static)', () => {
		const { engine, onReadout } = makeEngine({ reduced: true });
		engine.draw(0);
		expect(engine.isSettled()).toBe(true);
		expect(onReadout).toHaveBeenCalledWith(expect.objectContaining({ date: expect.any(String) }));
		const readout = onReadout.mock.calls[0][0];
		expect(readout.text).toBe('Milestone'); // the latest event at month 10 (HEAD)
	});

	it('is not settled mid-intro and settles once the 6s intro finishes', () => {
		const { engine } = makeEngine({ reduced: false });
		engine.setVisibility(true, 0.5); // E2: the intro only starts once visible
		engine.draw(0);
		expect(engine.isSettled()).toBe(false);
		engine.draw(6000);
		expect(engine.isSettled()).toBe(true);
	});

	it('does not start the intro until the visibility ratio reaches >= 0.5 for the first time (E2)', () => {
		const { engine } = makeEngine({ reduced: false });
		engine.draw(0); // never became visible — stays parked, not mid-intro
		expect(engine.isSettled()).toBe(true);
		engine.draw(3000);
		expect(engine.isSettled()).toBe(true);

		engine.setVisibility(true, 0.4); // below the 0.5 threshold — still not enough
		engine.draw(3016);
		expect(engine.isSettled()).toBe(true);

		engine.setVisibility(true, 0.5); // crosses the threshold — intro starts now
		engine.draw(3032);
		expect(engine.isSettled()).toBe(false);
	});

	it('never plays if it never becomes visible (E2)', () => {
		const { engine } = makeEngine({ reduced: false });
		for (let now = 0; now <= 6000; now += 1000) engine.draw(now);
		expect(engine.isSettled()).toBe(true);
	});

	it('plays the intro only once even if visibility flickers after it started (E2)', () => {
		const { engine } = makeEngine({ reduced: false });
		engine.setVisibility(true, 0.6);
		engine.draw(0);
		expect(engine.isSettled()).toBe(false);
		engine.setVisibility(false, 0);
		engine.setVisibility(true, 0.6);
		engine.draw(6000);
		expect(engine.isSettled()).toBe(true); // finished the same 6s intro, not restarted
	});

	it('parks at HEAD immediately under reduced motion even if it never becomes visible (E2)', () => {
		const { engine, onReadout } = makeEngine({ reduced: true });
		engine.draw(0); // no setVisibility() call at all
		expect(engine.isSettled()).toBe(true);
		expect(onReadout.mock.calls[0][0].text).toBe('Milestone'); // parked at HEAD, not month 0
	});

	it('fires onReadout only when the displayed month actually changes', () => {
		const { engine, onReadout } = makeEngine({ reduced: true });
		engine.draw(0);
		engine.draw(16); // still month 10 (HEAD) — same readout
		expect(onReadout).toHaveBeenCalledTimes(1);
	});

	it('scrub() moves the playhead to the given month and wakes the scheduler', () => {
		const { engine, wake, onReadout } = makeEngine({ reduced: true });
		engine.draw(0); // settle at HEAD first
		wake.mockClear();
		onReadout.mockClear();
		engine.scrub(EPOCH + 2);
		expect(wake).toHaveBeenCalled();
		engine.draw(1);
		expect(onReadout).toHaveBeenCalledWith(expect.objectContaining({ text: 'Started' }));
		// A scrub is a discrete input, not a running animation — the domain
		// playback reducer reports 'scrub' as settled so the scheduler only
		// redraws it on the next wake() rather than polling every frame.
		expect(engine.isSettled()).toBe(true);
	});

	it('key() and release() also wake the scheduler, same as scrub() (E3 — feedback renders after the intro settled)', () => {
		const { engine, wake } = makeEngine({ reduced: true });
		engine.draw(0); // settle at HEAD first
		wake.mockClear();
		engine.key('ArrowLeft');
		expect(wake).toHaveBeenCalled();
		wake.mockClear();
		engine.release();
		expect(wake).toHaveBeenCalled();
	});

	it('setFocusLane(id) scrubs to that lane’s start month', () => {
		const { engine, onReadout } = makeEngine({ reduced: true });
		engine.draw(0);
		onReadout.mockClear();
		engine.setFocusLane('a');
		engine.draw(1);
		expect(onReadout).toHaveBeenCalledWith(expect.objectContaining({ text: 'Started' }));
	});

	it('draws the grid to the canvas context', () => {
		const { engine, ctx } = makeEngine({ reduced: true });
		engine.draw(0);
		expect(ctx.clearRect).toHaveBeenCalled();
		expect(ctx.fillText).toHaveBeenCalled();
	});

	it('sets ctx.font to JetBrains Mono at the computed cell size before resize() paints anything (E1)', () => {
		const { ctx } = makeEngine({ reduced: true }); // makeEngine() already calls resize()
		expect(ctx.font).toMatch(/JetBrains Mono/);
		// `fillText` WAS called (by resize()'s own immediate repaint — see the
		// next test) — the guarantee E1 actually cares about is that the font
		// is correct BEFORE any of those calls, never the reset browser
		// default. `mock.calls[0]` is fillText's very first invocation ever.
		expect(ctx.fillText.mock.calls.length).toBeGreaterThan(0);
	});

	it('resize() immediately repaints the current frame, so reassigning canvas.width never leaves the canvas blank until the next scheduled tick', () => {
		// Regression: `canvas.width = ...`/`canvas.height = ...` (inside
		// resize(), to change the backing-store resolution) clears the whole
		// bitmap as a side effect. The shared scheduler only redraws settled
		// engines when something marks them dirty, throttled to one redraw
		// per ~40ms (design D14) — a ResizeObserver that fires more than once
		// in that window (common while fonts/layout settle, especially on
		// narrower viewports with more text reflow) used to leave the canvas
		// wiped-but-unpainted for a real, human-visible window. resize() must
		// repaint synchronously so the canvas is NEVER left blank.
		const { engine, ctx } = makeEngine({ reduced: true });
		expect(ctx.fillText.mock.calls.length).toBeGreaterThan(0); // the initial resize() already repainted

		// A second resize (e.g. a redundant ResizeObserver tick, same width)
		// wipes the bitmap again and must ALSO repaint immediately.
		ctx.fillText.mockClear();
		ctx.clearRect.mockClear();
		engine.resize();
		expect(ctx.clearRect).toHaveBeenCalled();
		expect(ctx.fillText).toHaveBeenCalled();
	});

	it('setReduced(true) mid-flight parks the timeline at HEAD', () => {
		const { engine } = makeEngine({ reduced: false });
		engine.setVisibility(true, 0.5); // E2: the intro only starts once visible
		engine.draw(0);
		expect(engine.isSettled()).toBe(false);
		engine.setReduced(true);
		engine.draw(1);
		expect(engine.isSettled()).toBe(true);
	});

	it('monthAtClientX converts a pointer position to a clamped month', () => {
		const { engine } = makeEngine({ reduced: true });
		expect(engine.monthAtClientX(130)).toBe(EPOCH); // near the left edge of the grid body (epoch, not 0)
		expect(engine.monthAtClientX(-9999)).toBe(EPOCH); // clamps below the start, to epoch — never to 0
		expect(engine.monthAtClientX(9999)).toBe(LAST); // clamps past HEAD
	});

	it('the very first frame (idle, before the intro starts) reports a valid readout at `epoch`, never an invalid month like "0-01" (regression: absolute Month domain, not legacy relative offsets)', () => {
		const { engine, onReadout } = makeEngine({ reduced: false });
		engine.draw(0); // never became visible yet — still idle, has not entered
		expect(onReadout).toHaveBeenCalled();
		const date = onReadout.mock.calls[0][0].date;
		expect(() => parseMonth(date)).not.toThrow();
		expect(date).toBe('2019-08');
	});
});
