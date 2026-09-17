import type { BirdPartKey } from '../fields/bird';
import { tokenRgba, type Tokens } from '../runtime/tokens';

/** Ambient sky cells (clouds and ripple hot-spots) the engine can classify a cell into. */
export type SkyAmbientKey = 'c0' | 'c1' | 'b0' | 'b1' | 'm0' | 'm1' | 'hotP' | 'hotC';

/** `gorget2` is an engine-level checkerboard variant of `gorget` (shimmer), not part of `sampleBird`. */
export type SkyColorKey = BirdPartKey | 'gorget2' | SkyAmbientKey;

/**
 * Resolves every hero sky cell key to a real color (owner rule: "real
 * hummingbird colors... green body, blue crown, pink/magenta gorget,
 * translucent wings"), ported from the legacy `Sky.prototype.buildPalette`.
 */
export function resolveSkyColor(key: SkyColorKey, tokens: Tokens): string {
	switch (key) {
		case 'c0':
			return tokenRgba(tokens.cyan, 0.26);
		case 'c1':
			return tokenRgba(tokens.cyan, 0.6);
		case 'b0':
			return tokenRgba(tokens.blue, 0.26);
		case 'b1':
			return tokenRgba(tokens.blue, 0.6);
		case 'm0':
			return tokenRgba(tokens.magenta, 0.26);
		case 'm1':
			return tokenRgba(tokens.magenta, 0.6);
		case 'hotP':
			return tokens.pink;
		case 'hotC':
			return tokens.cyan;
		case 'body':
			return tokens.green;
		case 'belly':
			return tokens.fg2;
		case 'tail':
			return tokenRgba(tokens.green, 0.8);
		case 'crown':
			return tokens.blue;
		case 'gorget':
			return tokens.pink;
		case 'gorget2':
			return tokens.magenta;
		case 'beak':
			return tokens.fg;
		case 'farwing':
			return tokenRgba(tokens.muted, 0.7);
		case 'ghost':
			return tokenRgba(tokens.muted, 0.45);
		case 'wing':
			return tokenRgba(tokens.fg2, 0.78);
		case 'petal':
			return tokens.pink;
		case 'fcenter':
			return tokens.yellow;
		case 'stem':
			return tokenRgba(tokens.green, 0.72);
		case 'eye':
			// Never actually drawn — the engine skips `eye` cells (a hole in the head).
			return tokens.bg;
	}
}
