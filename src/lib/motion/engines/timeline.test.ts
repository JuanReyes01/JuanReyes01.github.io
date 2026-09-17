import { describe, it, expect, vi } from 'vitest';
import { TimelineEngine } from './timeline';
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

const TIMELINE: Timeline = {
	epoch: 0,
	last: 10,
	lanes: [
		{ id: 'a', label: 'Alpha lane', short: 'A', color: 'cyan', m0: 0, m1: 10, row: 4, head: true }
	],
	events: [
		{ m: 0, lane: 'a', text: 'Started' },
		{ m: 5, lane: 'a', text: 'Milestone' }
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
		engine.scrub(2);
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
		expect(engine.monthAtClientX(130)).toBe(0); // near the left edge of the grid body
		expect(engine.monthAtClientX(-9999)).toBe(0); // clamps below the start
		expect(engine.monthAtClientX(9999)).toBe(10); // clamps past HEAD
	});
});
