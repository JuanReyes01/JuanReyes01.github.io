import type { LayoutResult, Timeline } from './types';

/** Monospace column width budgeted per grid cell, in CSS px. */
const CHAR_PX = 8;

/**
 * Computes the timeline grid layout for a given viewport width (design D4).
 * Only two densities exist: one column per month, or one column per two
 * months on narrow viewports where every month wouldn't fit.
 */
export function layoutFor(widthPx: number, t: Timeline): LayoutResult {
	const longestLabel = t.lanes.reduce((max, l) => Math.max(max, l.label.length), 0);
	const lab = longestLabel + 2;
	const rows = 3 + 2 * t.lanes.length;

	const totalMonths = t.last - t.epoch + 1;
	const availableCols = Math.max(0, Math.floor((widthPx - lab * CHAR_PX) / CHAR_PX));
	const step: 1 | 2 = totalMonths <= availableCols ? 1 : 2;
	// `+7` mirrors the legacy engine's trailing padding for the "HEAD" label
	// past the trunk's last commit, so the last month never overflows the grid.
	const cols = lab + Math.ceil(totalMonths / step) + 7;

	return { lab, step, cols, rows };
}
