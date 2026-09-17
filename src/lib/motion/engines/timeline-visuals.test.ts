import { describe, it, expect } from 'vitest';
import type { GridCell } from '../../domain/types';
import { cellColor, cellVisualState } from './timeline-visuals';
import type { Tokens } from '../runtime/tokens';

const TOKENS: Tokens = {
	bg: '#000',
	banner: '#001',
	fg: '#fff',
	fg2: '#eee',
	muted: '#888',
	line: '#333',
	cyan: '#0ff',
	magenta: '#f0f',
	yellow: '#ff0',
	green: '#0f0',
	blue: '#00f',
	pink: '#f88'
};

function cell(overrides: Partial<GridCell>): GridCell {
	return { chs: 'x', kind: 'h', ...overrides };
}

describe('cellVisualState', () => {
	it('fully lights a cell whose month is at or before the playhead', () => {
		const s = cellVisualState(cell({ mon: 5 }), 5, null, false);
		expect(s.alpha).toBe(1);
		expect(s.glyph).toBe('x');
		expect(s.glow).toBe(false);
	});

	it('dims a cell whose month is still in the future (owner rule: past lit / future dimmed)', () => {
		const s = cellVisualState(cell({ mon: 10 }), 5, null, false);
		expect(s.alpha).toBeCloseTo(0.32);
	});

	it('treats a cell with no month (chrome, e.g. HEAD label) as always lit', () => {
		const s = cellVisualState(cell({ mon: undefined }), 0, null, false);
		expect(s.alpha).toBe(1);
	});

	it('dims the trunk to 0.55x when a lane is focused', () => {
		const s = cellVisualState(cell({ mon: 0, lane: 'trunk' }), 5, 'ml', false);
		expect(s.alpha).toBeCloseTo(0.55);
	});

	it('dims a non-focused lane to 0.22x when a lane is focused', () => {
		const s = cellVisualState(cell({ mon: 0, lane: 'bs' }), 5, 'ml', false);
		expect(s.alpha).toBeCloseTo(0.22);
	});

	it('leaves the focused lane itself at full alpha', () => {
		const s = cellVisualState(cell({ mon: 0, lane: 'ml' }), 5, 'ml', false);
		expect(s.alpha).toBe(1);
	});

	it('shows a transient glow glyph on a commit cell for 3 months after the playhead passes', () => {
		const just = cellVisualState(cell({ kind: 'commit', mon: 5, chs: '●' }), 5, null, false);
		expect(just.glyph).toBe('◉');
		expect(just.glow).toBe(true);

		const stillGlowing = cellVisualState(
			cell({ kind: 'commit', mon: 5, chs: '●' }),
			7.9,
			null,
			false
		);
		expect(stillGlowing.glyph).toBe('◉');

		const faded = cellVisualState(cell({ kind: 'commit', mon: 5, chs: '●' }), 8, null, false);
		expect(faded.glyph).toBe('●');
		expect(faded.glow).toBe(false);
	});

	it('never glows a commit before the playhead reaches it', () => {
		const s = cellVisualState(cell({ kind: 'commit', mon: 5, chs: '●' }), 4, null, false);
		expect(s.glyph).toBe('●');
		expect(s.glow).toBe(false);
	});

	it('suppresses the commit glow entirely under reduced motion', () => {
		const s = cellVisualState(cell({ kind: 'commit', mon: 5, chs: '●' }), 5, null, true);
		expect(s.glyph).toBe('●');
		expect(s.glow).toBe(false);
	});
});

describe('cellColor', () => {
	it('resolves a lane color cell to its matching token', () => {
		expect(cellColor(cell({ color: 'cyan' }), TOKENS)).toBe(TOKENS.cyan);
	});

	it('resolves an axis cell to the line token', () => {
		expect(cellColor(cell({ kind: 'axis', color: 'neutral' }), TOKENS)).toBe(TOKENS.line);
	});

	it('resolves trunk/fork/head/neutral-label cells to the muted token', () => {
		expect(cellColor(cell({ kind: 'trunk', color: 'neutral' }), TOKENS)).toBe(TOKENS.muted);
		expect(cellColor(cell({ kind: 'fork', color: 'neutral' }), TOKENS)).toBe(TOKENS.muted);
		expect(cellColor(cell({ kind: 'head', color: 'neutral' }), TOKENS)).toBe(TOKENS.muted);
		expect(cellColor(cell({ kind: 'label', color: 'neutral' }), TOKENS)).toBe(TOKENS.muted);
	});
});
