/**
 * The single shared animation loop for every canvas engine (design D14):
 * one `requestAnimationFrame` chain, throttled to `frameMs` (~25fps at the
 * default 40ms — owner rule: "one ~25fps scheduler"), running only while at
 * least one registered engine is both visible and not yet settled. A
 * settled engine "leaves the loop" — it stops being drawn and the loop
 * itself stops requesting frames once every engine has settled — until
 * something calls {@link Scheduler.wake}, or {@link Scheduler.invalidate}
 * to force exactly one more draw even if the engine already reports itself
 * settled. The clock is injected so this class needs no real timers, DOM,
 * or `requestAnimationFrame` to test.
 */
export interface SchedulableEngine {
	visible: boolean;
	isSettled(): boolean;
	draw(now: number): void;
}

export interface SchedulerClock {
	now(): number;
	requestFrame(callback: (now: number) => void): number;
	cancelFrame(id: number): void;
	isHidden(): boolean;
}

/** The real browser clock: `requestAnimationFrame` + `document.hidden`. */
export function createBrowserClock(): SchedulerClock {
	return {
		now: () => performance.now(),
		requestFrame: (callback) => requestAnimationFrame(callback),
		cancelFrame: (id) => cancelAnimationFrame(id),
		isHidden: () => typeof document !== 'undefined' && document.hidden
	};
}

export const FRAME_MS = 40;

export class Scheduler {
	private readonly engines = new Set<SchedulableEngine>();
	/**
	 * Engines forced to draw at least once regardless of `isSettled()` (R2:
	 * without this, an external change — reduced-motion toggle, theme
	 * change, resize, scrub, key input — that flips an engine straight to
	 * "settled" without going through a draw first would make `wake()` a
	 * no-op forever, since `hasActiveEngine()` only looks for *unsettled*
	 * engines). Cleared once that forced draw actually happens.
	 */
	private readonly dirty = new Set<SchedulableEngine>();
	private frameId: number | null = null;
	private lastDrawTime: number;

	constructor(
		private readonly clock: SchedulerClock,
		private readonly frameMs: number = FRAME_MS
	) {
		this.lastDrawTime = clock.now();
	}

	/** Registers an engine and starts the loop if it isn't already running. Returns an unregister function. */
	add(engine: SchedulableEngine): () => void {
		this.engines.add(engine);
		this.kick();
		return () => {
			this.engines.delete(engine);
			this.dirty.delete(engine);
		};
	}

	/** Re-checks whether the loop should resume — call after an engine becomes unsettled again. */
	wake(): void {
		this.kick();
	}

	/**
	 * Forces exactly one more draw of `engine` on the next tick, even if it
	 * currently reports itself settled. Use this (instead of `wake()`) for
	 * any external change whose visual effect the engine's `isSettled()`
	 * doesn't already reflect yet — see the class doc above.
	 */
	invalidate(engine: SchedulableEngine): void {
		this.dirty.add(engine);
		this.kick();
	}

	private hasActiveEngine(): boolean {
		for (const engine of this.engines) {
			if (engine.visible && (!engine.isSettled() || this.dirty.has(engine))) return true;
		}
		return false;
	}

	private kick(): void {
		if (this.frameId !== null) return;
		if (!this.hasActiveEngine()) return;
		this.frameId = this.clock.requestFrame(this.tick);
	}

	private readonly tick = (now: number): void => {
		this.frameId = null;
		if (!this.clock.isHidden() && now - this.lastDrawTime >= this.frameMs) {
			this.lastDrawTime = now;
			for (const engine of this.engines) {
				if (!engine.visible) continue;
				const forced = this.dirty.has(engine);
				// R3: a settled, non-dirty engine already looks the same as
				// last frame — skip the wasted redraw instead of drawing it
				// unconditionally just because some other engine is active.
				if (engine.isSettled() && !forced) continue;
				engine.draw(now);
				this.dirty.delete(engine);
			}
		}
		this.kick();
	};
}
