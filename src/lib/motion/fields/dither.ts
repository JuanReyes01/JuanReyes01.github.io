/**
 * Ordered (Bayer) dithering for the field band's pane-header strip (design
 * D1 purity boundary, motion table "Band /field"). Ported verbatim from the
 * legacy 8x8 Bayer matrix and its `(value + 0.5) / 64` threshold table.
 */
export const BAYER_8X8: readonly number[] = [
	0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
	52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7,
	39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21
];

/** The ordered-dither threshold for cell `(x, y)`, tiled every 8 cells. */
export function bayerThreshold(x: number, y: number): number {
	const col = ((x % 8) + 8) % 8;
	const row = ((y % 8) + 8) % 8;
	const cell = BAYER_8X8[row * 8 + col];
	return (cell + 0.5) / 64;
}

/**
 * Whether a field `value` (expected roughly in `[0, 1]`) lights this cell,
 * matching the legacy strip draw loop's `v > THRESH[row + (x & 7)]` check —
 * a strict greater-than, so a value exactly on the threshold stays dark.
 */
export function passesDither(value: number, x: number, y: number): boolean {
	return value > bayerThreshold(x, y);
}

/**
 * A separate, smaller 4x4 dither table the hero sky mixes into its cloud
 * field before quantizing to the ASCII ramp (legacy `B4`) — distinct from
 * {@link BAYER_8X8}, which only the field band's pixel dithering uses.
 */
export const BAYER_4X4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The legacy hero field's `(B4[(y&3)*4+(x&3)] / 16 - 0.47)` dither offset, tiled every 4 cells. */
export function ditherOffset4x4(x: number, y: number): number {
	const col = ((x % 4) + 4) % 4;
	const row = ((y % 4) + 4) % 4;
	return BAYER_4X4[row * 4 + col] / 16 - 0.47;
}
