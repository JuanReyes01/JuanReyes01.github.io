import { describe, it, expect, vi } from 'vitest';
import { createReducedMotionWatcher } from './reduced-motion';

function fakeMediaQuery(initial: boolean) {
	let listener: (() => void) | null = null;
	return {
		matches: initial,
		addEventListener: (_type: 'change', cb: () => void) => {
			listener = cb;
		},
		removeEventListener: () => {
			listener = null;
		},
		fire(matches: boolean) {
			this.matches = matches;
			listener?.();
		}
	};
}

describe('createReducedMotionWatcher', () => {
	it('get() reflects the current matchMedia state', () => {
		const mq = fakeMediaQuery(true);
		const watcher = createReducedMotionWatcher(() => mq);
		expect(watcher.get()).toBe(true);
	});

	it('notifies subscribers with the new value when the media query changes', () => {
		const mq = fakeMediaQuery(false);
		const watcher = createReducedMotionWatcher(() => mq);
		const cb = vi.fn();
		watcher.subscribe(cb);
		mq.fire(true);
		expect(cb).toHaveBeenCalledWith(true);
		expect(watcher.get()).toBe(true);
	});

	it('unsubscribe stops future notifications for that listener only', () => {
		const mq = fakeMediaQuery(false);
		const watcher = createReducedMotionWatcher(() => mq);
		const a = vi.fn();
		const b = vi.fn();
		const unsubscribeA = watcher.subscribe(a);
		watcher.subscribe(b);
		unsubscribeA();
		mq.fire(true);
		expect(a).not.toHaveBeenCalled();
		expect(b).toHaveBeenCalledWith(true);
	});

	it('destroy() detaches the media query listener', () => {
		const mq = fakeMediaQuery(false);
		const removeSpy = vi.spyOn(mq, 'removeEventListener');
		const watcher = createReducedMotionWatcher(() => mq);
		watcher.destroy();
		expect(removeSpy).toHaveBeenCalledTimes(1);
	});
});
