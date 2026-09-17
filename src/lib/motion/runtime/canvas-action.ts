/**
 * The shared canvas engine lifecycle (design D14): mount → wait for the
 * box-drawing font subset to load → create the engine → resize + first
 * draw → register with the shared {@link Scheduler} → observe resize and
 * intersection → subscribe to theme and reduced-motion changes → destroy.
 * Every browser touchpoint is injected via {@link CanvasActionDeps} so the
 * lifecycle itself is unit-testable without jsdom; `motion/actions/*.ts`
 * wires the real browser implementation for production use.
 */
import type { SchedulableEngine, Scheduler } from './scheduler';
import type { ReducedMotionWatcher } from './reduced-motion';
import type { ThemeWatcher, Tokens } from './tokens';

export interface CanvasActionEnv {
	tokens: Tokens;
	reduced: boolean;
	/** Nudges the shared scheduler to re-check whether it should keep drawing this engine. */
	wake(): void;
}

/** The contract every canvas engine (sky/timeline/band) implements. */
export interface Engine {
	resize(): void;
	draw(now: number): void;
	setTheme(tokens: Tokens): void;
	setReduced(reduced: boolean): void;
	/**
	 * Reports the IntersectionObserver state (R1): `visible` mirrors
	 * `entry.isIntersecting`, `ratio` is `entry.intersectionRatio`. Every
	 * engine defaults to "not visible" until its first call — nothing may
	 * assume `visible: true` before the observer actually reports it.
	 */
	setVisibility(visible: boolean, ratio: number): void;
	isSettled(): boolean;
	destroy(): void;
}

interface DisconnectableObserver {
	observe(target: HTMLCanvasElement): void;
	disconnect(): void;
}

export interface CanvasActionDeps {
	scheduler: Scheduler;
	themeWatcher: ThemeWatcher;
	reducedMotionWatcher: ReducedMotionWatcher;
	loadFonts: () => Promise<void>;
	now: () => number;
	createResizeObserver?: (onResize: () => void) => DisconnectableObserver;
	createIntersectionObserver?: (
		onChange: (visible: boolean, ratio: number) => void
	) => DisconnectableObserver;
}

export interface CanvasActionHandle<P> {
	update?(params: P): void;
	destroy(): void;
}

/**
 * Builds a canvas lifecycle action bound to `deps`. `create` receives the
 * canvas, the action's params, and an env with the current theme/reduced
 * state plus a `wake()` callback the engine can call after an interaction
 * (e.g. a scrub) un-settles it, so the scheduler resumes drawing it.
 */
export function createCanvasAction<P>(
	deps: CanvasActionDeps,
	create: (canvas: HTMLCanvasElement, params: P, env: CanvasActionEnv) => Engine
): (node: HTMLCanvasElement, params: P) => CanvasActionHandle<P> {
	return (node, params) => {
		let engine: Engine | null = null;
		let destroyed = false;
		let unregisterScheduler: (() => void) | null = null;

		// R1: not visible by default — nothing may play until the
		// IntersectionObserver actually reports it, not before its first callback.
		const schedulable: SchedulableEngine = {
			visible: false,
			isSettled: () => engine?.isSettled() ?? true,
			draw: (now) => engine?.draw(now)
		};
		let lastVisible = false;
		let lastVisibleRatio = 0;

		// R2: force one draw on the next tick regardless of `isSettled()`.
		// A plain `wake()` is a no-op once the engine already reports
		// settled — e.g. `setReduced(true)` marks a timeline settled
		// synchronously, before anything has redrawn the now-stale canvas —
		// so every external change below invalidates instead of just waking.
		const wake = () => deps.scheduler.invalidate(schedulable);

		const unsubscribeTheme = deps.themeWatcher.subscribe((tokens) => {
			engine?.setTheme(tokens);
			wake();
		});
		const unsubscribeReduced = deps.reducedMotionWatcher.subscribe((reduced) => {
			engine?.setReduced(reduced);
			wake();
		});

		const resizeObserver = deps.createResizeObserver?.(() => {
			engine?.resize();
			wake();
		});
		resizeObserver?.observe(node);

		const intersectionObserver = deps.createIntersectionObserver?.((visible, ratio) => {
			lastVisible = visible;
			lastVisibleRatio = ratio;
			schedulable.visible = visible;
			engine?.setVisibility(visible, ratio);
			if (visible) wake();
		});
		intersectionObserver?.observe(node);

		void deps.loadFonts().then(() => {
			if (destroyed) return;
			engine = create(node, params, {
				tokens: deps.themeWatcher.get(),
				reduced: deps.reducedMotionWatcher.get(),
				wake
			});
			// Apply any visibility callback that already arrived before the
			// engine existed (fonts can resolve after the observer fires).
			engine.setVisibility(lastVisible, lastVisibleRatio);
			engine.resize();
			engine.draw(deps.now());
			unregisterScheduler = deps.scheduler.add(schedulable);
		});

		return {
			destroy() {
				destroyed = true;
				unregisterScheduler?.();
				unsubscribeTheme();
				unsubscribeReduced();
				resizeObserver?.disconnect();
				intersectionObserver?.disconnect();
				engine?.destroy();
			}
		};
	};
}
