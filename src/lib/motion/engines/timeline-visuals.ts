/**
 * Cell-level rendering rules for the experience timeline canvas (motion
 * table "Timeline", spec "Timeline plays once, then rests at HEAD"). Ported
 * from the legacy `Timeline.prototype.draw` loop, minus the two effects the
 * spec removes outright: the per-lane comet overlay and the HEAD pulse
 * (owner rule: "NO comets, NO HEAD pulse"). What stays: past-lit /
 * future-dimmed alpha, the focused-lane dimming, and each commit's
 * transient `◉` glow for the 3 months right after the playhead passes it.
 */
import type { GridCell, GridColor } from '../../domain/types';
import type { Tokens } from '../runtime/tokens';

/** Alpha for a cell whose month is still ahead of the playhead. */
const FUTURE_ALPHA = 0.32;
/** Alpha multiplier for the trunk when a lane is focused. */
const FOCUS_TRUNK_ALPHA = 0.55;
/** Alpha multiplier for a non-focused lane when a lane is focused. */
const FOCUS_OTHER_ALPHA = 0.22;
/** How many months a commit keeps its transient glow after the playhead passes it. */
const COMMIT_GLOW_MONTHS = 3;

export interface CellVisualState {
	glyph: string;
	alpha: number;
	glow: boolean;
}

/**
 * Computes the alpha/glyph/glow for one grid cell at the current playhead
 * position. `reduced` suppresses the transient commit glow, matching the
 * spec's "reduced motion renders one static frame" (the parked static
 * frame has the playhead resting at HEAD, so every commit's glow window
 * has already elapsed regardless — this guard is defense in depth).
 */
export function cellVisualState(
	cell: GridCell,
	playhead: number,
	focusLane: string | null,
	reduced: boolean
): CellVisualState {
	let alpha = cell.mon === undefined || cell.mon <= playhead ? 1 : FUTURE_ALPHA;

	if (focusLane && cell.lane) {
		if (cell.lane === 'trunk') alpha *= FOCUS_TRUNK_ALPHA;
		else if (cell.lane !== focusLane) alpha *= FOCUS_OTHER_ALPHA;
	}

	let glyph = cell.chs;
	let glow = false;
	if (cell.kind === 'commit' && !reduced && cell.mon !== undefined) {
		const since = playhead - cell.mon;
		if (since >= 0 && since < COMMIT_GLOW_MONTHS) {
			glyph = '◉';
			glow = true;
		}
	}

	return { glyph, alpha, glow };
}

/**
 * Resolves a grid cell's color token. Lane cells use their own lane color;
 * neutral chrome splits by kind — the axis uses `line`, everything else
 * (trunk, fork marks, the HEAD dot, and neutral labels) uses `muted` —
 * matching the legacy engine's two neutral shades (design instruction:
 * "axis = line color, trunk = muted").
 */
export function cellColor(
	cell: { kind: GridCell['kind']; color?: GridColor },
	tokens: Tokens
): string {
	if (cell.color && cell.color !== 'neutral') return tokens[cell.color];
	return cell.kind === 'axis' ? tokens.line : tokens.muted;
}
