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

/**
 * A `rows`-by-`cols` grid of lit/unlit dots, sampled once at a fixed instant.
 * Deterministic — calling this twice with the same size produces the exact
 * same pattern, which is the point: it's a single static frame, not a seed
 * for an animation.
 */
export function stripDots(cols: number, rows: number): boolean[][] {
	const grid: boolean[][] = [];
	for (let y = 0; y < rows; y++) {
		const row: boolean[] = [];
		for (let x = 0; x < cols; x++) {
			const { value } = iridescentField(
				(sx, sy) => sampleTexture(texturePrimary, sx, sy),
				(sx, sy) => sampleTexture(textureShimmer, sx, sy),
				x,
				y,
				STATIC_T
			);
			row.push(passesDither(value, x, y));
		}
		grid.push(row);
	}
	return grid;
}
