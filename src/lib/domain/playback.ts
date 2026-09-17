export const INTRO_MS = 6000;
export const RELEASE_MS = 1500;
export const RETURN_MS = 600;

export type PlaybackMode = 'idle' | 'intro' | 'rest' | 'scrub' | 'return';

export interface Playback {
	mode: PlaybackMode;
	P: number;
	startedAt: number;
	releasedAt: number;
	focusLane: string | null;
}

export type PlaybackEvent =
	| { type: 'enter' }
	| { type: 'scrub'; P: number }
	| { type: 'key'; key: string }
	| { type: 'release' }
	| { type: 'focusLane'; id: string | null };

export interface PlaybackContext {
	last: number;
	step: 1 | 2;
	reduced: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}

/**
 * Pure playback state machine for the experience timeline (design D4 /
 * motion table). No DOM, no timers — `now` is passed in by the caller so
 * this stays trivially testable with a fake clock.
 */
export function reduce(s: Playback, e: PlaybackEvent, now: number, c: PlaybackContext): Playback {
	switch (e.type) {
		case 'enter':
			return c.reduced
				? { ...s, mode: 'rest', P: c.last, startedAt: now, releasedAt: 0 }
				: { ...s, mode: 'intro', P: 0, startedAt: now, releasedAt: 0 };

		case 'scrub':
			return { ...s, mode: 'scrub', P: clamp(e.P, 0, c.last), releasedAt: 0 };

		case 'key': {
			const delta = keyDelta(e.key, c.step, s.P, c.last);
			if (delta === null) return s;
			return { ...s, mode: 'scrub', P: clamp(delta, 0, c.last) };
		}

		case 'release':
			return s.P >= c.last ? { ...s, mode: 'rest' } : { ...s, mode: 'return', releasedAt: now };

		case 'focusLane':
			return { ...s, focusLane: e.id };
	}
}

function keyDelta(key: string, step: number, p: number, last: number): number | null {
	switch (key) {
		case 'ArrowRight':
		case 'ArrowUp':
			return p + step;
		case 'ArrowLeft':
		case 'ArrowDown':
			return p - step;
		case 'Home':
			return 0;
		case 'End':
			return last;
		default:
			return null;
	}
}

/**
 * Computes the displayed playhead position for the current instant. Time
 * transitions (intro easing, the post-release pause, the glide home) live
 * here so `reduce` never needs a synthetic tick event.
 */
export function positionAt(
	s: Playback,
	now: number,
	c: { last: number }
): { P: number; settled: boolean } {
	if (s.mode === 'intro') {
		const t = clamp((now - s.startedAt) / INTRO_MS, 0, 1);
		return { P: easeOutCubic(t) * c.last, settled: t >= 1 };
	}

	if (s.mode === 'return') {
		const sincePause = now - s.releasedAt;
		if (sincePause < RELEASE_MS) return { P: s.P, settled: false };
		const glideT = clamp((sincePause - RELEASE_MS) / RETURN_MS, 0, 1);
		return { P: s.P + (c.last - s.P) * easeOutCubic(glideT), settled: glideT >= 1 };
	}

	return { P: s.P, settled: true };
}
