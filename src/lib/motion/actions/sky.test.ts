import { describe, it, expect, vi } from 'vitest';
import { createSkyAction } from './sky';
import { SkyEngine } from '../engines/sky';
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

function fakeCanvas(closest: (selector: string) => unknown = () => null) {
	const ctx = {
		font: '',
		textBaseline: '',
		fillStyle: '',
		setTransform: () => {},
		clearRect: () => {},
		fillText: () => {},
		measureText: () => ({ width: 7 })
	};
	return {
		getContext: () => ctx,
		getBoundingClientRect: () => ({ width: 600, height: 300, top: 0, left: 0 }),
		closest
	} as unknown as HTMLCanvasElement;
}

function fakeHost(children: Record<string, unknown> = {}) {
	const listeners: Record<string, Array<(e: unknown) => void>> = {};
	return {
		addEventListener: (type: string, cb: (e: unknown) => void) => {
			(listeners[type] ??= []).push(cb);
		},
		removeEventListener: (type: string, cb: (e: unknown) => void) => {
			listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
		},
		fire: (type: string, event: unknown) => listeners[type]?.forEach((cb) => cb(event)),
		getBoundingClientRect: () => ({ top: 0, left: 0, width: 600, height: 300 }),
		querySelector: (selector: string) => children[selector] ?? null
	};
}

describe('createSkyAction', () => {
	it('forwards pointermove ripple energy to the engine', async () => {
		const pokeSpy = vi.spyOn(SkyEngine.prototype, 'poke');
		const host = fakeHost();
		const attach = createSkyAction(fakeDeps());
		attach(fakeCanvas(), {
			host: host as unknown as HTMLElement,
			textEl: host as unknown as HTMLElement
		});
		await Promise.resolve();
		await Promise.resolve();

		host.fire('pointermove', { clientX: 10, clientY: 20 });
		expect(pokeSpy).toHaveBeenCalledWith(10, 20, expect.any(Number));
		pokeSpy.mockRestore();
	});

	it('pokes harder on pointerdown than a slow pointermove', async () => {
		const pokeSpy = vi.spyOn(SkyEngine.prototype, 'poke');
		const host = fakeHost();
		const attach = createSkyAction(fakeDeps());
		attach(fakeCanvas(), {
			host: host as unknown as HTMLElement,
			textEl: host as unknown as HTMLElement
		});
		await Promise.resolve();
		await Promise.resolve();

		host.fire('pointerdown', { clientX: 5, clientY: 5 });
		expect(pokeSpy).toHaveBeenCalledWith(5, 5, 14);
		pokeSpy.mockRestore();
	});

	it('forwards a touchmove position to the engine', async () => {
		const pokeSpy = vi.spyOn(SkyEngine.prototype, 'poke');
		const host = fakeHost();
		const attach = createSkyAction(fakeDeps());
		attach(fakeCanvas(), {
			host: host as unknown as HTMLElement,
			textEl: host as unknown as HTMLElement
		});
		await Promise.resolve();
		await Promise.resolve();

		host.fire('touchmove', { touches: [{ clientX: 30, clientY: 40 }] });
		expect(pokeSpy).toHaveBeenCalledWith(30, 40, 6);
		pokeSpy.mockRestore();
	});

	it('resets pointer speed tracking on pointerleave', async () => {
		const pokeSpy = vi.spyOn(SkyEngine.prototype, 'poke');
		const host = fakeHost();
		const attach = createSkyAction(fakeDeps());
		attach(fakeCanvas(), {
			host: host as unknown as HTMLElement,
			textEl: host as unknown as HTMLElement
		});
		await Promise.resolve();
		await Promise.resolve();

		host.fire('pointermove', { clientX: 0, clientY: 0 });
		host.fire('pointerleave', {});
		host.fire('pointermove', { clientX: 100, clientY: 0 });
		// After a leave, speed resets to 0 for the next move (no huge jump strength).
		const lastCall = pokeSpy.mock.calls.at(-1);
		expect(lastCall?.[2]).toBeLessThan(3);
		pokeSpy.mockRestore();
	});

	it('falls back to the closest .hero ancestor when host/textEl arrive undefined (F1 fix)', async () => {
		const pokeSpy = vi.spyOn(SkyEngine.prototype, 'poke');
		const host = fakeHost();
		const textEl = { getBoundingClientRect: () => ({ top: 0, left: 0, width: 200, height: 40 }) };
		host.querySelector = (selector: string) => (selector === '.hero-text' ? textEl : null);
		const canvas = fakeCanvas((selector) => (selector === '.hero' ? host : null));
		const attach = createSkyAction(fakeDeps());
		attach(canvas, {
			host: undefined as unknown as HTMLElement,
			textEl: undefined as unknown as HTMLElement
		});
		await Promise.resolve();
		await Promise.resolve();

		host.fire('pointerdown', { clientX: 3, clientY: 4 });
		expect(pokeSpy).toHaveBeenCalledWith(3, 4, 14);
		pokeSpy.mockRestore();
	});

	it('does not throw when host/textEl are undefined and no .hero ancestor exists, then wires listeners once update() supplies them (F1 fix)', async () => {
		const pokeSpy = vi.spyOn(SkyEngine.prototype, 'poke');
		const attach = createSkyAction(fakeDeps());
		const handle = attach(fakeCanvas(), {
			host: undefined as unknown as HTMLElement,
			textEl: undefined as unknown as HTMLElement
		});
		await Promise.resolve();
		await Promise.resolve();

		const host = fakeHost();
		handle.update?.({
			host: host as unknown as HTMLElement,
			textEl: host as unknown as HTMLElement
		});
		await Promise.resolve();
		await Promise.resolve();

		host.fire('pointerdown', { clientX: 3, clientY: 4 });
		expect(pokeSpy).toHaveBeenCalledWith(3, 4, 14);
		pokeSpy.mockRestore();
	});

	it('destroy() detaches the pointer/touch listeners', async () => {
		const pokeSpy = vi.spyOn(SkyEngine.prototype, 'poke');
		const host = fakeHost();
		const attach = createSkyAction(fakeDeps());
		const handle = attach(fakeCanvas(), {
			host: host as unknown as HTMLElement,
			textEl: host as unknown as HTMLElement
		});
		await Promise.resolve();
		await Promise.resolve();

		handle.destroy();
		host.fire('pointerdown', { clientX: 1, clientY: 1 });
		expect(pokeSpy).not.toHaveBeenCalled();
		pokeSpy.mockRestore();
	});
});
