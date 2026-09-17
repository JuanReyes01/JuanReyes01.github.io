import { describe, it, expect } from 'vitest';
import { reduce, positionAt, INTRO_MS, RELEASE_MS, RETURN_MS } from './playback';
import type { Playback } from './playback';

const CTX = { last: 100, step: 1 as const, reduced: false };
const idle: Playback = { mode: 'idle', P: 0, startedAt: 0, releasedAt: 0, focusLane: null };

describe('reduce', () => {
	it('enter starts the intro animation from 0', () => {
		const s = reduce(idle, { type: 'enter' }, 1000, CTX);
		expect(s.mode).toBe('intro');
		expect(s.P).toBe(0);
		expect(s.startedAt).toBe(1000);
	});

	it('enter jumps straight to rest at `last` under reduced motion', () => {
		const s = reduce(idle, { type: 'enter' }, 1000, { ...CTX, reduced: true });
		expect(s.mode).toBe('rest');
		expect(s.P).toBe(CTX.last);
	});

	it('scrub clamps P into [0, last]', () => {
		const s = reduce(idle, { type: 'scrub', P: 500 }, 0, CTX);
		expect(s.mode).toBe('scrub');
		expect(s.P).toBe(CTX.last);
	});

	it('scrub with an in-range value keeps it exactly', () => {
		const s = reduce(idle, { type: 'scrub', P: 42 }, 0, CTX);
		expect(s.P).toBe(42);
	});

	it('ArrowRight moves the playhead forward by one step', () => {
		const s = reduce({ ...idle, mode: 'scrub', P: 10 }, { type: 'key', key: 'ArrowRight' }, 0, CTX);
		expect(s.P).toBe(11);
	});

	it('ArrowLeft moves the playhead back by one step, not below 0', () => {
		const s = reduce({ ...idle, mode: 'scrub', P: 0 }, { type: 'key', key: 'ArrowLeft' }, 0, CTX);
		expect(s.P).toBe(0);
	});

	it('End jumps to `last`, Home jumps to 0', () => {
		const atEnd = reduce({ ...idle, mode: 'scrub', P: 5 }, { type: 'key', key: 'End' }, 0, CTX);
		expect(atEnd.P).toBe(CTX.last);
		const atHome = reduce(atEnd, { type: 'key', key: 'Home' }, 0, CTX);
		expect(atHome.P).toBe(0);
	});

	it('release from `last` settles straight into rest', () => {
		const s = reduce({ ...idle, mode: 'scrub', P: CTX.last }, { type: 'release' }, 0, CTX);
		expect(s.mode).toBe('rest');
	});

	it('release before `last` schedules a glide back via `return`', () => {
		const s = reduce({ ...idle, mode: 'scrub', P: 10 }, { type: 'release' }, 2000, CTX);
		expect(s.mode).toBe('return');
		expect(s.releasedAt).toBe(2000);
	});

	it('focusLane records the lane id without touching P or mode', () => {
		const s = reduce({ ...idle, mode: 'rest', P: 30 }, { type: 'focusLane', id: 'ml' }, 0, CTX);
		expect(s.focusLane).toBe('ml');
		expect(s.P).toBe(30);
		expect(s.mode).toBe('rest');
	});
});

describe('positionAt', () => {
	it('eases from 0 toward `last` during the intro window', () => {
		const s: Playback = { mode: 'intro', P: 0, startedAt: 0, releasedAt: 0, focusLane: null };
		const early = positionAt(s, INTRO_MS * 0.1, { last: CTX.last });
		const late = positionAt(s, INTRO_MS * 0.9, { last: CTX.last });
		expect(early.P).toBeGreaterThan(0);
		expect(late.P).toBeGreaterThan(early.P);
		expect(late.settled).toBe(false);
	});

	it('reports settled once the intro duration has fully elapsed', () => {
		const s: Playback = { mode: 'intro', P: 0, startedAt: 0, releasedAt: 0, focusLane: null };
		const done = positionAt(s, INTRO_MS, { last: CTX.last });
		expect(done.settled).toBe(true);
		expect(done.P).toBe(CTX.last);
	});

	it('rest/scrub report the stored P and settled immediately', () => {
		const s: Playback = { mode: 'scrub', P: 55, startedAt: 0, releasedAt: 0, focusLane: null };
		expect(positionAt(s, 999, { last: CTX.last })).toEqual({ P: 55, settled: true });
	});

	it('return holds position during the pause, then glides back to `last`', () => {
		const s: Playback = { mode: 'return', P: 40, startedAt: 0, releasedAt: 1000, focusLane: null };
		const duringPause = positionAt(s, 1000 + RELEASE_MS / 2, { last: CTX.last });
		expect(duringPause.P).toBe(40);
		expect(duringPause.settled).toBe(false);

		const afterGlide = positionAt(s, 1000 + RELEASE_MS + RETURN_MS, { last: CTX.last });
		expect(afterGlide.P).toBe(CTX.last);
		expect(afterGlide.settled).toBe(true);
	});
});
