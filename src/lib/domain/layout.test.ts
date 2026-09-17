import { describe, it, expect } from 'vitest';
import { layoutFor } from './layout';
import { deriveTimeline } from './timeline';
import { parseMonth } from './month';
import { REAL_ENTRIES, TODAY } from './fixtures';

const m = parseMonth;

const timeline = deriveTimeline(REAL_ENTRIES, TODAY);

describe('layoutFor', () => {
	it('sizes the label column from the longest lane label plus 2', () => {
		const l = layoutFor(1200, timeline);
		expect(l.lab).toBe('B.S. Electronics + B.S. Systems Eng.'.length + 2);
	});

	it('rows follow `3 + 2n` for n lanes', () => {
		const l = layoutFor(1200, timeline);
		expect(l.rows).toBe(3 + 2 * timeline.lanes.length);
	});

	it('uses step 1 (every month) when the viewport is wide enough', () => {
		const l = layoutFor(2000, timeline);
		expect(l.step).toBe(1);
	});

	it('falls back to step 2 (every other month) on a narrow viewport', () => {
		const l = layoutFor(320, timeline);
		expect(l.step).toBe(2);
	});

	it('cols reserves the label column plus the full epoch..last span plus 7 trailing columns for the HEAD label', () => {
		const totalMonths = timeline.last - timeline.epoch + 1;
		const l = layoutFor(2000, timeline);
		expect(l.cols).toBe(l.lab + Math.ceil(totalMonths / l.step) + 7);
	});

	it('reserves enough trailing columns that the last month never lands past the grid, even at step 2 with an odd month span', () => {
		// today = 2026-10 makes the epoch..last span 87 months (odd) at step 2.
		const oddTimeline = deriveTimeline(REAL_ENTRIES, m('2026-10'));
		const l = layoutFor(320, oddTimeline);
		const totalMonths = oddTimeline.last - oddTimeline.epoch + 1;
		expect(totalMonths % 2).toBe(1);
		const lastCol = l.lab + Math.floor((oddTimeline.last - oddTimeline.epoch) / l.step);
		expect(lastCol).toBeLessThan(l.cols);
		expect(l.cols - lastCol).toBe(8);
	});
});
