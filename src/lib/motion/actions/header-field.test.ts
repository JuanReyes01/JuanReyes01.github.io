import { describe, it, expect, vi } from 'vitest';
import { createHeaderFieldAction } from './header-field';
import { HeaderFieldEngine } from '../engines/header-field';
import type { CanvasActionDeps } from '../runtime/canvas-action';
import { Scheduler, type SchedulerClock } from '../runtime/scheduler';

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
	const ctx = {
		font: '',
		textBaseline: '',
		fillStyle: '',
		setTransform: () => {},
		clearRect: () => {},
		fillText: () => {},
		measureText: () => ({ width: 7 })
	};
	const listeners: Record<string, Array<(e: unknown) => void>> = {};
	return {
		getContext: () => ctx,
		getBoundingClientRect: () => ({ width: 1200, height: 220, top: 0, left: 0 }),
		addEventListener: (type: string, cb: (e: unknown) => void) => {
			(listeners[type] ??= []).push(cb);
		},
		removeEventListener: (type: string, cb: (e: unknown) => void) => {
			listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
		},
		fire: (type: string, event: unknown) => listeners[type]?.forEach((cb) => cb(event))
	} as unknown as HTMLCanvasElement & { fire: (type: string, event: unknown) => void };
}

describe('createHeaderFieldAction', () => {
	it('forwards pointermove ripple energy directly from the canvas (no separate host needed)', async () => {
		const pokeSpy = vi.spyOn(HeaderFieldEngine.prototype, 'poke');
		const canvas = fakeCanvas();
		const attach = createHeaderFieldAction(fakeDeps());
		attach(canvas, { section: 'work' });
		await Promise.resolve();
		await Promise.resolve();

		canvas.fire('pointermove', { clientX: 10, clientY: 20 });
		expect(pokeSpy).toHaveBeenCalledWith(10, 20, expect.any(Number));
		pokeSpy.mockRestore();
	});

	it('pokes harder on pointerdown than a slow pointermove', async () => {
		const pokeSpy = vi.spyOn(HeaderFieldEngine.prototype, 'poke');
		const canvas = fakeCanvas();
		const attach = createHeaderFieldAction(fakeDeps());
		attach(canvas, { section: 'work' });
		await Promise.resolve();
		await Promise.resolve();

		canvas.fire('pointerdown', { clientX: 5, clientY: 5 });
		expect(pokeSpy).toHaveBeenCalledWith(5, 5, 14);
		pokeSpy.mockRestore();
	});

	it('forwards a touchmove position to the engine', async () => {
		const pokeSpy = vi.spyOn(HeaderFieldEngine.prototype, 'poke');
		const canvas = fakeCanvas();
		const attach = createHeaderFieldAction(fakeDeps());
		attach(canvas, { section: 'field' });
		await Promise.resolve();
		await Promise.resolve();

		canvas.fire('touchmove', { touches: [{ clientX: 30, clientY: 40 }] });
		expect(pokeSpy).toHaveBeenCalledWith(30, 40, 6);
		pokeSpy.mockRestore();
	});

	it('destroy() detaches the pointer/touch listeners', async () => {
		const pokeSpy = vi.spyOn(HeaderFieldEngine.prototype, 'poke');
		const canvas = fakeCanvas();
		const attach = createHeaderFieldAction(fakeDeps());
		const handle = attach(canvas, { section: 'work' });
		await Promise.resolve();
		await Promise.resolve();

		handle.destroy();
		canvas.fire('pointerdown', { clientX: 1, clientY: 1 });
		expect(pokeSpy).not.toHaveBeenCalled();
		pokeSpy.mockRestore();
	});
});
