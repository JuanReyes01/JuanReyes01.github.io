import { describe, it, expect, vi } from 'vitest';
import { Scheduler, type SchedulerClock } from './scheduler';

function fakeClock(): SchedulerClock & {
	tick(now: number): void;
	hidden: boolean;
	frameCount: number;
} {
	let pendingCb: ((now: number) => void) | null = null;
	let nextId = 1;
	return {
		hidden: false,
		frameCount: 0,
		now: () => 0,
		requestFrame(cb) {
			pendingCb = cb;
			this.frameCount++;
			return nextId++;
		},
		cancelFrame() {
			pendingCb = null;
		},
		isHidden() {
			return this.hidden;
		},
		tick(now: number) {
			const cb = pendingCb;
			pendingCb = null;
			cb?.(now);
		}
	};
}

function fakeEngine(overrides: Partial<{ visible: boolean; settled: boolean }> = {}) {
	const draws: number[] = [];
	return {
		visible: overrides.visible ?? true,
		isSettled: () => overrides.settled ?? false,
		draw: (now: number) => draws.push(now),
		draws
	};
}

describe('Scheduler', () => {
	it('does not schedule a frame when the only engine is invisible', () => {
		const clock = fakeClock();
		const scheduler = new Scheduler(clock);
		const engine = fakeEngine({ visible: false });
		scheduler.add(engine);
		expect(clock.frameCount).toBe(0);
		expect(engine.draws).toEqual([]);
	});

	it('does not schedule a frame when the only engine is already settled', () => {
		const clock = fakeClock();
		const scheduler = new Scheduler(clock);
		const engine = fakeEngine({ settled: true });
		scheduler.add(engine);
		expect(clock.frameCount).toBe(0);
	});

	it('draws every visible, unsettled engine on each tick and keeps scheduling while one remains active', () => {
		const clock = fakeClock();
		const scheduler = new Scheduler(clock);
		const engine = fakeEngine();
		scheduler.add(engine);
		expect(clock.frameCount).toBe(1);

		clock.tick(40);
		expect(engine.draws).toEqual([40]);
		expect(clock.frameCount).toBe(2); // rescheduled for the next frame

		clock.tick(80);
		expect(engine.draws).toEqual([40, 80]);
	});

	it('stops scheduling once every engine has settled', () => {
		const clock = fakeClock();
		const scheduler = new Scheduler(clock);
		let settled = false;
		const engine = { visible: true, isSettled: () => settled, draw: vi.fn() };
		scheduler.add(engine);
		expect(clock.frameCount).toBe(1);

		settled = true;
		clock.tick(40);
		expect(engine.draw).toHaveBeenCalledTimes(1); // last tick before settling still draws once
		expect(clock.frameCount).toBe(1); // no further frame requested — engine left the loop
	});

	it('resumes the loop when wake() is called after settling', () => {
		const clock = fakeClock();
		const scheduler = new Scheduler(clock);
		let settled = true;
		const engine = { visible: true, isSettled: () => settled, draw: vi.fn() };
		scheduler.add(engine);
		expect(clock.frameCount).toBe(0);

		settled = false;
		scheduler.wake();
		expect(clock.frameCount).toBe(1);
		clock.tick(45); // clears the same frameMs budget as any other tick — wake() does not bypass it
		expect(engine.draw).toHaveBeenCalledWith(45);
	});

	it('skips draws while the document is hidden but keeps the scheduler alive', () => {
		const clock = fakeClock();
		const scheduler = new Scheduler(clock);
		const engine = fakeEngine();
		scheduler.add(engine);

		clock.hidden = true;
		clock.tick(40);
		expect(engine.draws).toEqual([]);
		expect(clock.frameCount).toBe(2); // still rescheduled so it can resume once visible again
	});

	it('stops considering an engine once its unregister function is called', () => {
		const clock = fakeClock();
		const scheduler = new Scheduler(clock);
		const engine = fakeEngine();
		const unregister = scheduler.add(engine);
		unregister();
		clock.tick(40);
		expect(engine.draws).toEqual([]);
		expect(clock.frameCount).toBe(1); // no engines left, no more frames requested
	});

	it('throttles draws to roughly frameMs by skipping ticks that arrive too soon', () => {
		const clock = fakeClock();
		const scheduler = new Scheduler(clock, 40);
		const engine = fakeEngine();
		scheduler.add(engine);

		clock.tick(10); // well under 40ms since start (now()=0) — should not draw yet
		expect(engine.draws).toEqual([]);
		clock.tick(45); // now past the 40ms budget
		expect(engine.draws).toEqual([45]);
	});
});
