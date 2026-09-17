import { describe, it, expect } from 'vitest';
import { reduce, positionAt, RELEASE_MS, RETURN_MS } from './playback';
import type { Playback } from './playback';

// `epoch` is deliberately non-zero here (unlike a naive `0`) because
// `Month` is an ABSOLUTE `year*12+(month-1)` index (design D1), not a
// timeline-relative offset like the legacy engine's `m`.
const CTX = { last: 100, epoch: 20, step: 1 as const };

// The timeline never plays an automatic intro (owner decision, v2 direction
// slice S1: "kill the timeline's automatic epoch sweep") — every fixture
// starts already at rest, at HEAD (`last`), exactly like the real engine's
// initial state.
const rest: Playback = { mode: 'rest', P: CTX.last, releasedAt: 0, focusLane: null };

describe('reduce', () => {
	it('scrub clamps P into [epoch, last]', () => {
		const s = reduce(rest, { type: 'scrub', P: 500 }, 0, CTX);
		expect(s.mode).toBe('scrub');
		expect(s.P).toBe(CTX.last);
	});

	it('scrub below `epoch` clamps up to `epoch`, never to 0', () => {
		const s = reduce(rest, { type: 'scrub', P: -500 }, 0, CTX);
		expect(s.P).toBe(CTX.epoch);
	});

	it('scrub with an in-range value keeps it exactly', () => {
		const s = reduce(rest, { type: 'scrub', P: 42 }, 0, CTX);
		expect(s.P).toBe(42);
	});

	it('ArrowRight moves the playhead forward by one step', () => {
		const s = reduce(
			{ ...rest, mode: 'scrub', P: CTX.epoch + 10 },
			{ type: 'key', key: 'ArrowRight' },
			0,
			CTX
		);
		expect(s.P).toBe(CTX.epoch + 11);
	});

	it('ArrowLeft moves the playhead back by one step, not below `epoch`', () => {
		const s = reduce(
			{ ...rest, mode: 'scrub', P: CTX.epoch },
			{ type: 'key', key: 'ArrowLeft' },
			0,
			CTX
		);
		expect(s.P).toBe(CTX.epoch);
	});

	it('End jumps to `last`, Home jumps to `epoch`', () => {
		const atEnd = reduce({ ...rest, mode: 'scrub', P: 5 }, { type: 'key', key: 'End' }, 0, CTX);
		expect(atEnd.P).toBe(CTX.last);
		const atHome = reduce(atEnd, { type: 'key', key: 'Home' }, 0, CTX);
		expect(atHome.P).toBe(CTX.epoch);
	});

	it('release from `last` settles straight into rest', () => {
		const s = reduce({ ...rest, mode: 'scrub', P: CTX.last }, { type: 'release' }, 0, CTX);
		expect(s.mode).toBe('rest');
	});

	it('release before `last` schedules a glide back via `return`', () => {
		const s = reduce({ ...rest, mode: 'scrub', P: 10 }, { type: 'release' }, 2000, CTX);
		expect(s.mode).toBe('return');
		expect(s.releasedAt).toBe(2000);
	});

	it('focusLane records the lane id without touching P or mode', () => {
		const s = reduce({ ...rest, P: 30 }, { type: 'focusLane', id: 'ml' }, 0, CTX);
		expect(s.focusLane).toBe('ml');
		expect(s.P).toBe(30);
		expect(s.mode).toBe('rest');
	});
});

describe('positionAt', () => {
	it('rest reports the stored P immediately, settled — no automatic intro plays (owner decision: kill the epoch sweep)', () => {
		expect(positionAt(rest, 999, { last: CTX.last })).toEqual({ P: CTX.last, settled: true });
	});

	it('scrub reports the stored P and settled immediately', () => {
		const s: Playback = { mode: 'scrub', P: 55, releasedAt: 0, focusLane: null };
		expect(positionAt(s, 999, { last: CTX.last })).toEqual({ P: 55, settled: true });
	});

	it('return holds position during the pause, then glides back to `last`', () => {
		const s: Playback = { mode: 'return', P: 40, releasedAt: 1000, focusLane: null };
		const duringPause = positionAt(s, 1000 + RELEASE_MS / 2, { last: CTX.last });
		expect(duringPause.P).toBe(40);
		expect(duringPause.settled).toBe(false);

		const afterGlide = positionAt(s, 1000 + RELEASE_MS + RETURN_MS, { last: CTX.last });
		expect(afterGlide.P).toBe(CTX.last);
		expect(afterGlide.settled).toBe(true);
	});
});
