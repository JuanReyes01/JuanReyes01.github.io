import { describe, it, expect } from 'vitest';
import { drawCharGrid, layoutCharGrid } from './char-grid';

describe('drawCharGrid', () => {
	function fakeCtx() {
		const calls: Array<{ text: string; color: string }> = [];
		const ctx = {
			fillStyle: '',
			fillText(text: string) {
				calls.push({ text, color: ctx.fillStyle });
			}
		};
		return { ctx, calls };
	}

	it('draws nothing and returns 0 draw calls for an all-space grid', () => {
		const { ctx, calls } = fakeCtx();
		const drawCalls = drawCharGrid(ctx, 4, 2, 10, () => ({ glyph: ' ', color: '#fff' }));
		expect(drawCalls).toBe(0);
		expect(calls).toHaveLength(0);
	});

	it('batches same-row same-color cells into ONE fillText call, not one per cell', () => {
		const { ctx, calls } = fakeCtx();
		// 5 cells, all the same color -> exactly one draw call for that row.
		const drawCalls = drawCharGrid(ctx, 5, 1, 10, () => ({ glyph: '#', color: 'red' }));
		expect(drawCalls).toBe(1);
		expect(calls).toHaveLength(1);
		expect(calls[0].text).toBe('#####');
		expect(calls[0].color).toBe('red');
	});

	it('issues a separate draw call per distinct color within the same row', () => {
		const { ctx, calls } = fakeCtx();
		const drawCalls = drawCharGrid(ctx, 4, 1, 10, (x) => ({
			glyph: x < 2 ? 'a' : 'b',
			color: x < 2 ? 'red' : 'blue'
		}));
		expect(drawCalls).toBe(2);
		const byColor = new Map(calls.map((c) => [c.color, c.text]));
		expect(byColor.get('red')).toBe('aa  ');
		expect(byColor.get('blue')).toBe('  bb');
	});

	it('draws each row at y * cellHeight', () => {
		const { ctx } = fakeCtx();
		const yArgs: number[] = [];
		const spyCtx = {
			fillStyle: '',
			fillText: (_text: string, _x: number, y: number) => {
				yArgs.push(y);
			}
		};
		drawCharGrid(spyCtx, 2, 3, 12, () => ({ glyph: '@', color: 'green' }));
		expect(yArgs).toEqual([0, 12, 24]);
		void ctx;
	});

	it('skips a cell when cellAt returns null', () => {
		const { ctx, calls } = fakeCtx();
		const drawCalls = drawCharGrid(ctx, 3, 1, 10, (x) =>
			x === 1 ? null : { glyph: '#', color: 'c' }
		);
		expect(drawCalls).toBe(1);
		expect(calls[0].text).toBe('# #');
	});
});

describe('layoutCharGrid', () => {
	function fakeCanvas(width: number, height: number) {
		let setWidth = 0;
		let setHeight = 0;
		const canvas = {
			get width() {
				return setWidth;
			},
			set width(v: number) {
				setWidth = v;
			},
			get height() {
				return setHeight;
			},
			set height(v: number) {
				setHeight = v;
			},
			getBoundingClientRect: () => ({
				width,
				height,
				top: 0,
				left: 0,
				right: width,
				bottom: height
			})
		};
		return canvas as unknown as HTMLCanvasElement;
	}

	function fakeCtx() {
		return {
			font: '',
			setTransform: () => {},
			measureText: () => ({ width: 7 })
		} as unknown as CanvasRenderingContext2D;
	}

	it('returns null for a genuinely unlaid-out (zero-width) canvas', () => {
		const layout = layoutCharGrid({
			canvas: fakeCanvas(0, 0),
			ctx: fakeCtx(),
			dpr: 1,
			fontPx: 12,
			fontFamily: 'monospace'
		});
		expect(layout).toBeNull();
	});

	it('derives cols/rows from the CSS rect and the measured character size', () => {
		const layout = layoutCharGrid({
			canvas: fakeCanvas(700, 140),
			ctx: fakeCtx(),
			dpr: 1,
			fontPx: 12,
			fontFamily: 'monospace'
		});
		expect(layout).not.toBeNull();
		// cw = 7 (fake measureText), ch = round(12 * 1.22) = 15.
		expect(layout!.cw).toBe(7);
		expect(layout!.ch).toBe(15);
		expect(layout!.cols).toBe(Math.ceil(700 / 7));
		expect(layout!.rows).toBe(Math.ceil(140 / 15));
	});

	it('scales the canvas backing resolution by dpr', () => {
		const canvas = fakeCanvas(100, 50);
		layoutCharGrid({ canvas, ctx: fakeCtx(), dpr: 2, fontPx: 12, fontFamily: 'monospace' });
		expect(canvas.width).toBe(200);
		expect(canvas.height).toBe(100);
	});

	it('never returns cols/rows below the provided minimums', () => {
		const layout = layoutCharGrid({
			canvas: fakeCanvas(10, 5),
			ctx: fakeCtx(),
			dpr: 1,
			fontPx: 12,
			fontFamily: 'monospace',
			minCols: 20,
			minRows: 6
		});
		expect(layout!.cols).toBe(20);
		expect(layout!.rows).toBe(6);
	});
});
