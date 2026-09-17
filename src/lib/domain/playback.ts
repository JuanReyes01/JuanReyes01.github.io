export const RELEASE_MS = 1500;
export const RETURN_MS = 600;

export type PlaybackMode = 'rest' | 'scrub' | 'return';

export interface Playback {
	mode: PlaybackMode;
	P: number;
	releasedAt: number;
	focusLane: string | null;
}

export type PlaybackEvent =
	| { type: 'scrub'; P: number }
	| { type: 'key'; key: string }
	| { type: 'release' }
	| { type: 'focusLane'; id: string | null };

export interface PlaybackContext {
	last: number;
	/**
	 * The timeline's earliest month (`Timeline.epoch`, design D4) — the
	 * playhead's lower bound for scrubbing. This must NEVER be literal `0`:
	 * `Month` is an absolute `year*12+(month-1)` index (design D1), so `0`
	 * means "January, year 0", not "the start of the timeline".
	 */
	epoch: number;
	step: 1 | 2;
}

function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}

/**
 * Pure playback state machine for the timeline (design D4 / motion table,
 * updated per v2 direction slice S1: the timeline has no automatic intro —
 * the owner disliked the automatic epoch sweep, so the graph renders
 * complete and at rest from the very first frame; the playhead only moves
 * on pointer scrub, arrow keys, or row hover/focus). No DOM, no timers —
 * `now` is passed in by the caller so this stays trivially testable with a
 * fake clock.
 */
export function reduce(s: Playback, e: PlaybackEvent, now: number, c: PlaybackContext): Playback {
	switch (e.type) {
		case 'scrub':
			return { ...s, mode: 'scrub', P: clamp(e.P, c.epoch, c.last), releasedAt: 0 };

		case 'key': {
			const delta = keyDelta(e.key, c.step, s.P, c.last, c.epoch);
			if (delta === null) return s;
			return { ...s, mode: 'scrub', P: clamp(delta, c.epoch, c.last) };
		}

		case 'release':
			return s.P >= c.last ? { ...s, mode: 'rest' } : { ...s, mode: 'return', releasedAt: now };

		case 'focusLane':
			return { ...s, focusLane: e.id };
	}
}

function keyDelta(
	key: string,
	step: number,
	p: number,
	last: number,
	epoch: number
): number | null {
	switch (key) {
		case 'ArrowRight':
		case 'ArrowUp':
			return p + step;
		case 'ArrowLeft':
		case 'ArrowDown':
			return p - step;
		case 'Home':
			return epoch;
		case 'End':
			return last;
		default:
			return null;
	}
}

/**
 * Computes the displayed playhead position for the current instant. `rest`
 * and `scrub` report their stored `P` immediately — there is no automatic
 * animation to ease through. `return` (the glide back to HEAD after a
 * pointer/touch release away from HEAD) is the only mode with a time-based
 * transition, so it's the only one that lives here instead of in `reduce`.
 */
export function positionAt(
	s: Playback,
	now: number,
	c: { last: number }
): { P: number; settled: boolean } {
	if (s.mode === 'return') {
		const sincePause = now - s.releasedAt;
		if (sincePause < RELEASE_MS) return { P: s.P, settled: false };
		const glideT = clamp((sincePause - RELEASE_MS) / RETURN_MS, 0, 1);
		return { P: s.P + (c.last - s.P) * easeOutCubic(glideT), settled: glideT >= 1 };
	}

	return { P: s.P, settled: true };
}
