/**
 * Shared `prefers-reduced-motion` watcher (design D14/D15): every engine
 * reads the same flag and stops scheduling animation when it's set. The
 * `matchMedia` lookup is injected so this stays testable without jsdom.
 */
interface MediaQueryLike {
	matches: boolean;
	addEventListener(type: 'change', callback: () => void): void;
	removeEventListener(type: 'change', callback: () => void): void;
}

export interface ReducedMotionWatcher {
	get(): boolean;
	subscribe(callback: (reduced: boolean) => void): () => void;
	destroy(): void;
}

export function createReducedMotionWatcher(
	matchMedia: (query: string) => MediaQueryLike
): ReducedMotionWatcher {
	const media = matchMedia('(prefers-reduced-motion: reduce)');
	const subscribers = new Set<(reduced: boolean) => void>();

	const onChange = () => {
		for (const callback of subscribers) callback(media.matches);
	};
	media.addEventListener('change', onChange);

	return {
		get: () => media.matches,
		subscribe(callback) {
			subscribers.add(callback);
			return () => {
				subscribers.delete(callback);
			};
		},
		destroy() {
			media.removeEventListener('change', onChange);
			subscribers.clear();
		}
	};
}
