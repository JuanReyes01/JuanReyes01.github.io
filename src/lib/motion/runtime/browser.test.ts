import { describe, it, expect, vi, afterEach } from 'vitest';
import { createVisibilityObserver, loadFonts, watchDevicePixelRatio } from './browser';

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

describe('loadFonts', () => {
	it('does nothing when document/document.fonts is unavailable (SSR)', async () => {
		await expect(loadFonts()).resolves.toBeUndefined();
	});

	it('requests every glyph the engines draw (R4): ━─│┼┬┴╰╯╮●◉▼', async () => {
		const load = vi.fn<(spec: string, text: string) => Promise<void>>(() => Promise.resolve());
		vi.stubGlobal('document', { fonts: { load } });

		await loadFonts();

		expect(load).toHaveBeenCalledTimes(1);
		const [spec, text] = load.mock.calls[0];
		expect(spec).toContain('JetBrains Mono');
		for (const glyph of '━─│┼┬┴╰╯╮●◉▼') {
			expect(text).toContain(glyph);
		}
	});

	it('does not throw when document.fonts.load() rejects — draws anyway with the fallback font (R5)', async () => {
		vi.stubGlobal('document', {
			fonts: { load: () => Promise.reject(new Error('network error')) }
		});

		await expect(loadFonts()).resolves.toBeUndefined();
	});
});

describe('watchDevicePixelRatio', () => {
	it('re-subscribes to a (resolution) media query and re-fires onChange when DPR crosses (R5)', () => {
		const listeners: Array<() => void> = [];
		const queries: string[] = [];
		let dpr = 1;
		vi.stubGlobal('window', {
			matchMedia: (query: string) => {
				queries.push(query);
				return {
					matches: true,
					media: query,
					addEventListener: (_type: string, cb: () => void) => listeners.push(cb),
					removeEventListener: (_type: string, cb: () => void) => {
						const i = listeners.indexOf(cb);
						if (i >= 0) listeners.splice(i, 1);
					}
				};
			},
			get devicePixelRatio() {
				return dpr;
			}
		});

		const onChange = vi.fn();
		const unwatch = watchDevicePixelRatio(onChange);
		expect(queries).toEqual(['(resolution: 1dppx)']);

		dpr = 2;
		listeners[0](); // simulate the browser firing the media query's 'change' event
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(queries).toEqual(['(resolution: 1dppx)', '(resolution: 2dppx)']); // re-subscribed at the new DPR

		unwatch();
		expect(listeners).toHaveLength(0);
	});

	it('is a no-op when window.matchMedia is unavailable (SSR)', () => {
		const unwatch = watchDevicePixelRatio(() => {});
		expect(() => unwatch()).not.toThrow();
	});
});
