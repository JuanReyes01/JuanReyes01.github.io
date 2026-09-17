/**
 * A static, server-renderable "dither strip" for pane headers (owner request
 * R2, apply-fix batch: "every page gets a figlet header... and the
 * legacy-style slim dither strip beside it"). Reuses the SAME field-sampling
 * code the `/field` band already uses (`iridescentField` + the ordered
 * Bayer dither from `dither.ts`) — see `motion/engines/band.ts` — but at a
 * single fixed instant instead of an animated loop, and dropping the band's
 * per-cell `ink` (green/cyan/blue): this strip renders every lit cell in
 * ONE flat color, the caller's `--pc` section accent (design "in the
 * section colour"), so it stays pure text/markup with no `Tokens`/DOM
 * dependency and can render on `csr:false` routes (`/work/`) with zero
 * client JS — unlike `BandEngine`, this is never registered with the
 * shared scheduler and never redrawn (owner rule: one moving thing per
 * screen — home/experience/work already have their own protagonist, or
 * none at all, so this strip must never animate).
 */
import { makeTexture, sampleTexture } from './noise';
import { iridescentField } from './iridescence';
import { passesDither } from './dither';

/** Matches `BandEngine.seedT` — an arbitrary fixed phase, not "the start" of anything. */
const STATIC_T = 4.2;

const texturePrimary = makeTexture(90210);
const textureShimmer = makeTexture(1337);

/** Alternating-row scanline dimming (legacy pane-header `Strip.prototype.draw`'s
 * `scan = (y & 1) ? 0.7 : 1`, also matched by `BandEngine`'s `SCANLINE_DIM`). */
const SCANLINE_DIM = 0.7;

/**
 * A `rows`-by-`cols` grid of lit/unlit dots, sampled once at a fixed instant.
 * Deterministic — calling this twice with the same size produces the exact
 * same pattern, which is the point: it's a single static frame, not a seed
 * for an animation.
 */
export function stripDots(cols: number, rows: number): boolean[][] {
	const grid: boolean[][] = [];
	for (let y = 0; y < rows; y++) {
		const scanline = y % 2 === 1 ? SCANLINE_DIM : 1;
		const row: boolean[] = [];
		for (let x = 0; x < cols; x++) {
			const { value } = iridescentField(
				(sx, sy) => sampleTexture(texturePrimary, sx, sy),
				(sx, sy) => sampleTexture(textureShimmer, sx, sy),
				x,
				y,
				STATIC_T
			);
			row.push(passesDither(value * scanline, x, y));
		}
		grid.push(row);
	}
	return grid;
}

/**
 * Flattens {@link stripDots} into a single SVG `<path>` `d` attribute: one
 * tiny `1x1` square per lit cell (`M{x} {y}h1v1h-1z`), in cell-index units
 * (not physical pixels) so every coordinate is a short integer. One `<path>`
 * scales far better than one `<rect>` per dot once the grid is sampled at a
 * real dither resolution (hundreds of cells) instead of a coarse ~40x10 one.
 */
export function stripPath(cols: number, rows: number): string {
	const grid = stripDots(cols, rows);
	let d = '';
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			if (grid[y][x]) d += `M${x} ${y}h1v1h-1z`;
		}
	}
	return d;
}
