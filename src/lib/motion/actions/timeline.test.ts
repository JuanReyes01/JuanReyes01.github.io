import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTimelineAction } from './timeline';
import { TimelineEngine } from '../engines/timeline';
import type { Timeline } from '../../domain/types';
import type { CanvasActionDeps } from '../runtime/canvas-action';
import { Scheduler, type SchedulerClock } from '../runtime/scheduler';

const TIMELINE: Timeline = {
	epoch: 0,
	last: 10,
	lanes: [
		{ id: 'a', label: 'Alpha lane', short: 'A', color: 'cyan', m0: 0, m1: 10, row: 4, head: true }
	],
	events: [{ m: 0, lane: 'a', text: 'Started' }]
};

function fakeDeps(): CanvasActionDeps {
	const clock: SchedulerClock = {
		now: () => 0,
		requestFrame: () => 1,
		cancelFrame: () => {},
		isHidden: () => false
	};
	return {
		scheduler: new Scheduler(clock),
		themeWatcher: { get: () => ({}) as never, subscribe: () => () => {}, destroy: () => {} },
		reducedMotionWatcher: { get: () => false, subscribe: () => () => {}, destroy: () => {} },
		loadFonts: () => Promise.resolve(),
		now: () => 0
	};
}

function fakeCanvas() {
	const listeners: Record<string, Array<(e: unknown) => void>> = {};
	const ctx = {
		font: '',
		textBaseline: '',
		textAlign: '',
		fillStyle: '',
		globalAlpha: 1,
		shadowColor: '',
		shadowBlur: 0,
		style: {},
		setTransform: () => {},
		clearRect: () => {},
		fillRect: () => {},
		fillText: () => {},
		measureText: () => ({ width: 7 })
	};
	const canvas = {
		style: {} as Record<string, string>,
		setPointerCapture: vi.fn(),
		getContext: () => ctx,
		getBoundingClientRect: () => ({ width: 900, height: 0, top: 0, left: 0 }),
		addEventListener: (type: string, cb: (e: unknown) => void) => {
			(listeners[type] ??= []).push(cb);
		},
		removeEventListener: (type: string, cb: (e: unknown) => void) => {
			listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
		}
	};
	return {
		canvas: canvas as unknown as HTMLCanvasElement,
		fire: (type: string, event: unknown = {}) => listeners[type]?.forEach((cb) => cb(event))
	};
}

async function attachTimeline() {
	const scrubSpy = vi.spyOn(TimelineEngine.prototype, 'scrub');
	const keySpy = vi.spyOn(TimelineEngine.prototype, 'key');
	const releaseSpy = vi.spyOn(TimelineEngine.prototype, 'release');
	const { canvas, fire } = fakeCanvas();
	const action = createTimelineAction(fakeDeps());
	const handle = action(canvas, { timeline: TIMELINE });
	await Promise.resolve();
	await Promise.resolve();
	return { canvas, fire, handle, scrubSpy, keySpy, releaseSpy };
}

describe('createTimelineAction', () => {
	// Every test re-spies on the shared TimelineEngine.prototype; vi.spyOn
	// returns the SAME mock across tests once a method is already spied, so
	// leftover call counts would otherwise bleed into the next test.
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('scrubs on pointermove using the target month plus 0.5, matching the legacy snap', async () => {
		const { fire, scrubSpy } = await attachTimeline();
		fire('pointermove', { clientX: 130 });
		expect(scrubSpy).toHaveBeenCalledWith(0.5);
	});

	it('captures the pointer and scrubs on pointerdown', async () => {
		const { canvas, fire, scrubSpy } = await attachTimeline();
		fire('pointerdown', { clientX: 130, pointerId: 1 });
		expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
		expect(scrubSpy).toHaveBeenCalledWith(0.5);
	});

	it('releases on pointerleave, non-mouse pointerup, and blur', async () => {
		const { fire, releaseSpy } = await attachTimeline();
		fire('pointerleave');
		fire('pointerup', { pointerType: 'touch' });
		fire('blur');
		expect(releaseSpy).toHaveBeenCalledTimes(3);
	});

	it('does not release on a mouse pointerup (mouse uses pointerleave/pointerdown only)', async () => {
		const { fire, releaseSpy } = await attachTimeline();
		fire('pointerup', { pointerType: 'mouse' });
		expect(releaseSpy).not.toHaveBeenCalled();
	});

	it('dispatches ArrowLeft/ArrowRight/Home/End as key input and prevents default', async () => {
		const { fire, keySpy } = await attachTimeline();
		for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
			const preventDefault = vi.fn();
			fire('keydown', { key, preventDefault });
			expect(keySpy).toHaveBeenCalledWith(key);
			expect(preventDefault).toHaveBeenCalled();
		}
	});

	it('ignores keys with a modifier held, and unrelated keys', async () => {
		const { fire, keySpy } = await attachTimeline();
		fire('keydown', { key: 'ArrowLeft', ctrlKey: true, preventDefault: vi.fn() });
		fire('keydown', { key: 'Tab', preventDefault: vi.fn() });
		expect(keySpy).not.toHaveBeenCalled();
	});

	it('exposes focusLane(id) on the action handle', async () => {
		const focusSpy = vi.spyOn(TimelineEngine.prototype, 'setFocusLane');
		const { handle } = await attachTimeline();
		handle.focusLane('a');
		expect(focusSpy).toHaveBeenCalledWith('a');
	});

	it('destroy() detaches every listener', async () => {
		const { canvas, fire, handle, scrubSpy } = await attachTimeline();
		handle.destroy();
		fire('pointermove', { clientX: 130 });
		expect(scrubSpy).not.toHaveBeenCalled();
		expect(canvas.setPointerCapture).not.toHaveBeenCalled();
	});
});
