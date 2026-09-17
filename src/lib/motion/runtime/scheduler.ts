/**
 * The single shared animation loop for every canvas engine (design D14):
 * one `requestAnimationFrame` chain, throttled to `frameMs` (~25fps at the
 * default 40ms — owner rule: "one ~25fps scheduler"), running only while at
 * least one registered engine is both visible and not yet settled. A
 * settled engine "leaves the loop" — it stops being drawn and the loop
 * itself stops requesting frames once every engine has settled — until
 * something calls {@link Scheduler.wake}. The clock is injected so this
 * class needs no real timers, DOM, or `requestAnimationFrame` to test.
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
		};
	}

	/** Re-checks whether the loop should resume — call after an engine becomes unsettled again. */
	wake(): void {
		this.kick();
	}

	private hasActiveEngine(): boolean {
		for (const engine of this.engines) {
			if (engine.visible && !engine.isSettled()) return true;
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
				if (engine.visible) engine.draw(now);
			}
		}
		this.kick();
	};
}
