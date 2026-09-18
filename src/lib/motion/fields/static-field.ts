/**
 * A deterministic, single-frame character field for ZERO-JS pages (owner
 * decision `site/v2-direction` slice S3, item C): `/work/[slug]/`,
 * `/experience/` and `/404` must stay zero client JS but still get a
 * full-bleed ASCII header, "in the spirit of" the same header every
 * hydrated page gets. Reuses the exact same ambient cloud field and
 * directional-glyph sampling `HeaderFieldEngine` draws to a canvas
 * (`clouds.ts`, `glyphs.ts`), evaluated once at BUILD TIME with a fixed seed
 * and instant — pure TS, no canvas, no DOM, no client JS — and returned as
 * plain text rows for a server-rendered `<pre>` (design D1 boundary: this
 * file lives in `motion/fields/`, so it's linted DOM-free like every other
 * field).
 */
import { makeTexture, sampleTexture } from './noise';
import { cloudField } from './clouds';
import { pickGlyph, DENSITY_RAMP } from './glyphs';

/** An arbitrary fixed instant — matches the spirit of `BandEngine`/
 * `HeaderFieldEngine`'s own fixed reduced-motion seed times: a calm, static
 * pose, not "the start" of anything. */
const STATIC_T = 6.4;
/** Lower than the canvas engines' `EDGE_THRESHOLD` (0.16) — a static header
 * is typically shorter (fewer rows) than a full hero, which flattens the
 * cloud field's own gradient range; tuned so directional edges still trace
 * cloud boundaries at a realistic header size instead of the whole field
 * falling back to the density ramp. */
const EDGE_THRESHOLD = 0.07;
/** A cell-space scale roughly matching a real header's `cw`/`ch` ratio at a
 * typical font size (~7px wide, ~14px tall) — there is no real canvas or
 * font metrics here, but using the same ratio keeps the static field's
 * proportions visually consistent with the hydrated header engines. */
const UNIT_X = 7 / 3;
const UNIT_Y = 14 / 3;

const textureA = makeTexture(2027);
const textureB = makeTexture(4091);

/**
 * A `rows`-by-`cols` grid of directional-glyph/density-ramp characters,
 * sampled once at a fixed instant. Deterministic — calling this twice with
 * the same size produces the exact same field, which is the point: it's a
 * single static frame baked in at build time, not a seed for an animation.
 */
export function staticFieldRows(cols: number, rows: number): string[] {
	const heightUnits = rows / 3;
	const sampleA = (x: number, y: number) => sampleTexture(textureA, x, y);
	const sampleB = (x: number, y: number) => sampleTexture(textureB, x, y);
	const cellField = (cx: number, cy: number): number =>
		cloudField(sampleA, sampleB, cx * UNIT_X, cy * UNIT_Y, STATIC_T, heightUnits);

	const out: string[] = [];
	for (let y = 0; y < rows; y++) {
		let line = '';
		for (let x = 0; x < cols; x++) {
			const value = cellField(x, y);
			line += pickGlyph(cellField, x, y, value, {
				edgeThreshold: EDGE_THRESHOLD,
				ramp: DENSITY_RAMP
			});
		}
		out.push(line);
	}
	return out;
}
