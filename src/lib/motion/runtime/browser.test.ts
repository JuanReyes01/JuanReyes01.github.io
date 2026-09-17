import { describe, it, expect, vi, afterEach } from 'vitest';
import { createVisibilityObserver } from './browser';

afterEach(() => {
	vi.unstubAllGlobals();
});

type IntersectionEntryLike = { isIntersecting: boolean; intersectionRatio: number };

describe('createVisibilityObserver', () => {
	it('observes with thresholds [0, 0.5] and forwards isIntersecting + intersectionRatio (R1)', () => {
		const fakeInstance = { observe: vi.fn(), disconnect: vi.fn() };
		const ctorSpy = vi.fn<
			(
				callback: (entries: IntersectionEntryLike[]) => void,
				options?: { threshold?: number[] }
			) => typeof fakeInstance
		>(function () {
			return fakeInstance;
		});
		vi.stubGlobal('IntersectionObserver', ctorSpy);

		const onChange = vi.fn();
		createVisibilityObserver(onChange);

		const [callback, options] = ctorSpy.mock.calls[0];
		expect(options?.threshold).toEqual([0, 0.5]);
		callback([{ isIntersecting: true, intersectionRatio: 0.6 }]);
		expect(onChange).toHaveBeenCalledWith(true, 0.6);
		callback([{ isIntersecting: false, intersectionRatio: 0 }]);
		expect(onChange).toHaveBeenCalledWith(false, 0);
	});

	it('disconnect() disconnects the underlying IntersectionObserver', () => {
		const fakeInstance = { observe: vi.fn(), disconnect: vi.fn() };
		vi.stubGlobal(
			'IntersectionObserver',
			vi.fn(function () {
				return fakeInstance;
			})
		);

		const observer = createVisibilityObserver(() => {});
		observer.disconnect();
		expect(fakeInstance.disconnect).toHaveBeenCalledTimes(1);
	});
});
