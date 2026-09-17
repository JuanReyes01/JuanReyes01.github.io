/**
 * Shared types for the content-derived career timeline (design D4).
 * `Month` is an integer month index (`year*12 + (month-1)`), never a Date —
 * this keeps every domain module pure and DST/timezone-free (design D1).
 */
export type Month = number;

export type LaneColor = 'cyan' | 'magenta' | 'yellow' | 'green' | 'blue' | 'pink';

export interface TimelineEvent {
	at: Month;
	text: string;
}

export interface TimelineInput {
	id: string;
	start: Month;
	end: Month | 'present';
	lane: { label: string; short: string; color: LaneColor };
	promotedFrom?: string;
	events: TimelineEvent[];
}

export interface Lane {
	id: string;
	label: string;
	short: string;
	color: LaneColor;
	m0: Month;
	m1: Month;
	row: number;
	head: boolean;
	into?: string;
	parent?: string;
}

export interface TimelineDatedEvent {
	m: Month;
	lane: string;
	text: string;
}

export interface Timeline {
	epoch: Month;
	last: Month;
	lanes: Lane[];
	events: TimelineDatedEvent[];
}

export interface LayoutResult {
	lab: number;
	step: 1 | 2;
	cols: number;
	rows: number;
}

/**
 * Cell purpose, mirrored from the legacy canvas engine's own `kind` tags —
 * the motion engine (PR4) uses this to decide what to dim/glow, so it must
 * stay a closed, meaningful set rather than a generic "filled/empty" flag.
 */
export type GridCellKind =
	'empty' | 'axis' | 'trunk' | 'fork' | 'v' | 'h' | 'corner' | 'commit' | 'head' | 'label';

/** Lane accent colors plus the neutral tone used for axis/trunk chrome. */
export type GridColor = LaneColor | 'neutral';

export interface GridCell {
	chs: string;
	kind: GridCellKind;
	color?: GridColor;
	lane?: string;
	mon?: Month;
}

export interface Grid {
	rows: number;
	cols: number;
	cells: GridCell[][];
}
