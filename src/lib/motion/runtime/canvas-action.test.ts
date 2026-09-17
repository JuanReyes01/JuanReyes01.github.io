import { describe, it, expect, vi } from 'vitest';
import { createCanvasAction, type CanvasActionDeps, type Engine } from './canvas-action';
import { Scheduler, type SchedulerClock } from './scheduler';
import type { Tokens } from './tokens';

function fakeSchedulerClock(): SchedulerClock {
	return {
		now: () => 0,
		requestFrame: () => 1,
		cancelFrame: () => {},
		isHidden: () => false
	};
}

function fakeEngine(): Engine & { resizeCalls: number; draws: number[] } {
	return {
		resizeCalls: 0,
		draws: [],
		resize() {
			this.resizeCalls++;
		},
		draw(now: number) {
			this.draws.push(now);
		},
		setTheme: vi.fn(),
		setReduced: vi.fn(),
		isSettled: () => false,
		destroy: vi.fn()
	};
}

function makeDeps(overrides: Partial<CanvasActionDeps> = {}): {
	deps: CanvasActionDeps;
	fireResize: () => void;
	fireIntersection: (visible: boolean) => void;
	fireTheme: () => void;
	fireReduced: (reduced: boolean) => void;
	resizeDisconnected: () => boolean;
	intersectionDisconnected: () => boolean;
} {
	let resizeCb: (() => void) | null = null;
	let intersectionCb: ((visible: boolean) => void) | null = null;
	let themeCb: ((tokens: Tokens) => void) | null = null;
	let reducedCb: ((reduced: boolean) => void) | null = null;
	let resizeDisconnected = false;
	let intersectionDisconnected = false;

	const deps: CanvasActionDeps = {
		scheduler: new Scheduler(fakeSchedulerClock()),
		themeWatcher: {
			get: () => ({}) as never,
			subscribe: (cb) => {
				themeCb = cb;
				return () => {
					themeCb = null;
				};
			},
			destroy: () => {}
		},
		reducedMotionWatcher: {
			get: () => false,
			subscribe: (cb) => {
				reducedCb = cb;
				return () => {
					reducedCb = null;
				};
			},
			destroy: () => {}
		},
		loadFonts: () => Promise.resolve(),
		now: () => 0,
		createResizeObserver: (cb) => {
			resizeCb = cb;
			return { observe: () => {}, disconnect: () => (resizeDisconnected = true) };
		},
		createIntersectionObserver: (cb) => {
			intersectionCb = cb;
			return { observe: () => {}, disconnect: () => (intersectionDisconnected = true) };
		},
		...overrides
	};

	return {
		deps,
		fireResize: () => resizeCb?.(),
		fireIntersection: (visible) => intersectionCb?.(visible),
		fireTheme: () => themeCb?.({} as Tokens),
		fireReduced: (reduced) => reducedCb?.(reduced),
		resizeDisconnected: () => resizeDisconnected,
		intersectionDisconnected: () => intersectionDisconnected
	};
}

const fakeCanvas = {} as HTMLCanvasElement;

describe('createCanvasAction', () => {
	it('creates the engine after fonts load, then resizes and draws the first frame', async () => {
		const { deps } = makeDeps();
		const engine = fakeEngine();
		const action = createCanvasAction(deps, () => engine);
		action(fakeCanvas, {});
		await Promise.resolve();
		await Promise.resolve();

		expect(engine.resizeCalls).toBe(1);
		expect(engine.draws).toEqual([0]);
	});

	it('passes the current tokens and reduced-motion flag to create()', async () => {
		const tokens = { fg: '#fff' };
		const { deps } = makeDeps({
			themeWatcher: {
				get: () => tokens as never,
				subscribe: () => () => {},
				destroy: () => {}
			},
			reducedMotionWatcher: {
				get: () => true,
				subscribe: () => () => {},
				destroy: () => {}
			}
		});
		const engine = fakeEngine();
		const createSpy = vi.fn<
			(
				canvas: HTMLCanvasElement,
				params: object,
				env: { tokens: Tokens; reduced: boolean; wake(): void }
			) => Engine
		>(() => engine);
		createCanvasAction(deps, createSpy)(fakeCanvas, {});
		await Promise.resolve();
		await Promise.resolve();

		expect(createSpy).toHaveBeenCalledTimes(1);
		const env = createSpy.mock.calls[0][2];
		expect(env.tokens).toBe(tokens);
		expect(env.reduced).toBe(true);
	});

	it('resizes the engine and wakes the scheduler on a ResizeObserver callback', async () => {
		const { deps, fireResize } = makeDeps();
		const engine = fakeEngine();
		const wakeSpy = vi.spyOn(deps.scheduler, 'wake');
		createCanvasAction(deps, () => engine)(fakeCanvas, {});
		await Promise.resolve();
		await Promise.resolve();

		fireResize();
		expect(engine.resizeCalls).toBe(2);
		expect(wakeSpy).toHaveBeenCalled();
	});

	it('tracks visibility from the IntersectionObserver and wakes on becoming visible', async () => {
		const { deps, fireIntersection } = makeDeps();
		const engine = fakeEngine();
		const wakeSpy = vi.spyOn(deps.scheduler, 'wake');
		createCanvasAction(deps, () => engine)(fakeCanvas, {});
		await Promise.resolve();
		await Promise.resolve();

		fireIntersection(true);
		expect(wakeSpy).toHaveBeenCalled();
	});

	it('forwards theme and reduced-motion changes to the engine and wakes the scheduler', async () => {
		const { deps, fireTheme, fireReduced } = makeDeps();
		const engine = fakeEngine();
		const wakeSpy = vi.spyOn(deps.scheduler, 'wake');
		createCanvasAction(deps, () => engine)(fakeCanvas, {});
		await Promise.resolve();
		await Promise.resolve();

		fireTheme();
		expect(engine.setTheme).toHaveBeenCalledTimes(1);
		fireReduced(true);
		expect(engine.setReduced).toHaveBeenCalledWith(true);
		expect(wakeSpy).toHaveBeenCalled();
	});

	it('destroy() tears down the engine, observers and subscriptions', async () => {
		const { deps, resizeDisconnected, intersectionDisconnected } = makeDeps();
		const engine = fakeEngine();
		const action = createCanvasAction(deps, () => engine);
		const handle = action(fakeCanvas, {});
		await Promise.resolve();
		await Promise.resolve();

		handle.destroy();
		expect(engine.destroy).toHaveBeenCalledTimes(1);
		expect(resizeDisconnected()).toBe(true);
		expect(intersectionDisconnected()).toBe(true);
	});

	it('never creates the engine if destroy() runs before fonts finish loading', async () => {
		let resolveFonts: () => void = () => {};
		const fontsPromise = new Promise<void>((resolve) => {
			resolveFonts = resolve;
		});
		const { deps } = makeDeps({ loadFonts: () => fontsPromise });
		const createSpy = vi.fn(() => fakeEngine());
		const action = createCanvasAction(deps, createSpy);
		const handle = action(fakeCanvas, {});
		handle.destroy();
		resolveFonts();
		await Promise.resolve();
		await Promise.resolve();

		expect(createSpy).not.toHaveBeenCalled();
	});
});
