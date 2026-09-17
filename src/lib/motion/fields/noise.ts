/**
 * Seeded value-noise textures for the sky and field-band engines (design
 * D1 purity boundary — no DOM/canvas access here, only pure math), ported
 * verbatim from the legacy `makeTexture`/`tex` pair: an xorshift32 PRNG
 * seeds four octaves of bilinearly-interpolated lattice noise, smoothstep
 * eased and normalized so every texture value lands in `[0, 1]`.
 */
export const TEXTURE_SIZE = 256;

/** `[lattice size, amplitude]` per octave, coarse to fine. */
const OCTAVES: Array<[number, number]> = [
	[4, 1],
	[8, 0.5],
	[16, 0.25],
	[32, 0.125]
];

function smoothstep(t: number): number {
	return t * t * (3 - 2 * t);
}

/** Deterministic 32-bit xorshift PRNG, matching the legacy inline generator. */
function makeRandom(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s ^= s << 13;
		s >>>= 0;
		s ^= s >>> 17;
		s ^= s << 5;
		s >>>= 0;
		return (s % 100000) / 100000;
	};
}

/**
 * Builds a `TEXTURE_SIZE x TEXTURE_SIZE` seeded noise texture. Deterministic
 * for a given seed — the sky and band engines memoize one texture per seed
 * and sample it every frame via {@link sampleTexture} instead of
 * regenerating it (design D14, "noise textures are memoized lazily").
 */
export function makeTexture(seed: number): Float32Array {
	const rnd = makeRandom(seed);
	const out = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);
	let total = 0;

	for (const [n, amp] of OCTAVES) {
		const step = TEXTURE_SIZE / n;
		const lattice = new Float32Array(n * n);
		for (let k = 0; k < lattice.length; k++) lattice[k] = rnd();

		for (let y = 0; y < TEXTURE_SIZE; y++) {
			const fy = y / step;
			const y0 = Math.floor(fy);
			const y1 = (y0 + 1) % n;
			const ty = smoothstep(fy - y0);
			for (let x = 0; x < TEXTURE_SIZE; x++) {
				const fx = x / step;
				const x0 = Math.floor(fx);
				const x1 = (x0 + 1) % n;
				const tx = smoothstep(fx - x0);
				const a = lattice[y0 * n + x0] + (lattice[y0 * n + x1] - lattice[y0 * n + x0]) * tx;
				const b = lattice[y1 * n + x0] + (lattice[y1 * n + x1] - lattice[y1 * n + x0]) * tx;
				out[y * TEXTURE_SIZE + x] += (a + (b - a) * ty) * amp;
			}
		}
		total += amp;
	}

	for (let i = 0; i < out.length; i++) out[i] /= total;
	return out;
}

/**
 * Samples a texture at (possibly fractional, possibly out-of-range)
 * coordinates. Coordinates are floored then wrapped with a bitmask, exactly
 * like the legacy `tex()` helper — including its handling of negative
 * coordinates, since `-1 & 255 === 255` in JS bitwise semantics.
 */
export function sampleTexture(texture: Float32Array, x: number, y: number): number {
	const xi = Math.floor(x) & (TEXTURE_SIZE - 1);
	const yi = Math.floor(y) & (TEXTURE_SIZE - 1);
	return texture[yi * TEXTURE_SIZE + xi];
}
