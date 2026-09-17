import { describe, it, expect, vi } from 'vitest';
import { scramble } from './scramble';

function fakeRow() {
	const listeners: Record<string, Array<() => void>> = {};
	return {
		addEventListener: (type: string, cb: () => void) => {
			(listeners[type] ??= []).push(cb);
		},
		removeEventListener: (type: string, cb: () => void) => {
			listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb);
		},
		fire: (type: string) => listeners[type]?.forEach((cb) => cb())
	};
}

function fakeNode(text: string, row: ReturnType<typeof fakeRow> | null) {
	let content = text;
	return {
		get textContent() {
			return content;
		},
		set textContent(value: string) {
			content = value;
		},
		setAttribute: vi.fn(),
		closest: () => row
	};
}

function manualFrameQueue() {
	const pending: Array<() => void> = [];
	return {
		requestFrame: (cb: () => void) => {
			pending.push(cb);
			return pending.length;
		},
		cancelFrame: () => {},
		flushOne: () => pending.shift()?.(),
		flushAll: () => {
			while (pending.length) pending.shift()?.();
		}
	};
}

describe('scramble', () => {
	it('marks the node aria-hidden (the sr-only copy lives elsewhere in the DOM)', () => {
		const node = fakeNode('Timeline', null);
		scramble(node as unknown as HTMLElement, {});
		expect(node.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');
	});

	it('scrambles then restores the exact original text on mouseenter', () => {
		const row = fakeRow();
		const node = fakeNode('Timeline', row);
		const frames = manualFrameQueue();
		scramble(node as unknown as HTMLElement, {
			requestFrame: frames.requestFrame,
			cancelFrame: frames.cancelFrame
		});

		row.fire('mouseenter');
		expect(node.textContent).not.toBe('Timeline'); // first frame already scrambled it
		frames.flushAll();
		expect(node.textContent).toBe('Timeline');
	});

	it('does nothing under reduced motion', () => {
		const row = fakeRow();
		const node = fakeNode('Timeline', row);
		const frames = manualFrameQueue();
		const requestSpy = vi.fn(frames.requestFrame);
		scramble(node as unknown as HTMLElement, {
			reduced: () => true,
			requestFrame: requestSpy,
			cancelFrame: frames.cancelFrame
		});

		row.fire('mouseenter');
		expect(requestSpy).not.toHaveBeenCalled();
		expect(node.textContent).toBe('Timeline');
	});

	it('ignores a re-trigger while already scrambling (busy guard)', () => {
		const row = fakeRow();
		const node = fakeNode('Timeline', row);
		const frames = manualFrameQueue();
		const requestSpy = vi.fn(frames.requestFrame);
		scramble(node as unknown as HTMLElement, {
			requestFrame: requestSpy,
			cancelFrame: frames.cancelFrame
		});

		row.fire('mouseenter');
		const callsAfterFirst = requestSpy.mock.calls.length;
		row.fire('focusin'); // fired again mid-animation — should be a no-op
		expect(requestSpy.mock.calls.length).toBe(callsAfterFirst);
		frames.flushAll();
	});

	it('destroy() detaches the row listeners and cancels any pending frame', () => {
		const row = fakeRow();
		const node = fakeNode('Timeline', row);
		const frames = manualFrameQueue();
		const cancelSpy = vi.fn(frames.cancelFrame);
		const handle = scramble(node as unknown as HTMLElement, {
			requestFrame: frames.requestFrame,
			cancelFrame: cancelSpy
		});

		row.fire('mouseenter');
		handle?.destroy?.();
		expect(cancelSpy).toHaveBeenCalled();

		row.fire('mouseenter'); // after destroy, this must not restart the animation
		expect(node.textContent).toBe('Timeline');
	});
});
