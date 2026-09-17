/**
 * The hero canvas engine (design D14/D15, motion table "Sky /"): ambient
 * cloud drift + a pointer/touch ripple wave + the calm hummingbird, all in
 * one character grid — ported from the legacy `Sky` class. Runs as an
 * ambient loop for as long as it's visible (never "settles") unless
 * reduced motion is active, in which case it renders the legacy's fixed
 * `t=11.3` frame with no ripple, matching the spec's static-frame rule.
 */
import { sampleTexture, makeTexture } from '../fields/noise';
import { cloudField } from '../fields/clouds';
import { pokeRipple, stepRipple } from '../fields/ripple';
import { birdGeometryScale, computeBirdMotion, sampleBird, type BirdFrame } from '../fields/bird';
import { ditherOffset4x4 } from '../fields/dither';
import { clamp01 } from '../fields/math';
import { resolveSkyColor } from './sky-palette';
import type { Engine } from '../runtime/canvas-action';
import type { Tokens } from '../runtime/tokens';

const RAMP = ' .·:-=+*#%@';
const RAMP_LAST_INDEX = RAMP.length - 1;
/** The legacy engine's fixed reduced-motion pose ("Static frame (t=11.3)"). */
const REDUCED_SEED_T = 11.3;

export interface MeasurableRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

export interface MeasurableElement {
	getBoundingClientRect(): MeasurableRect;
}

export interface SkyEngineOptions {
	canvas: HTMLCanvasElement;
	host: MeasurableElement;
	textEl: MeasurableElement;
	spaceEl?: MeasurableElement | null;
	tokens: Tokens;
	reduced: boolean;
}

function devicePixelRatioCapped(): number {
	if (typeof window === 'undefined') return 1;
	return Math.min(window.devicePixelRatio || 1, 2);
}

export class SkyEngine implements Engine {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private readonly host: MeasurableElement;
	private readonly textEl: MeasurableElement;
	private readonly spaceEl?: MeasurableElement | null;
	private tokens: Tokens;
	private reduced: boolean;

	private readonly textureA = makeTexture(1337);
	private readonly textureB = makeTexture(90210);

	private width = 0;
	private height = 0;
	private cw = 7;
	private ch = 14;
	private cols = 0;
	private rows = 0;
	private fontSize = 12;

	private bird = { S: 150, ax: 0, ay: 0 };
	private ripple: { current: Float32Array; previous: Float32Array } | null = null;

	constructor(opts: SkyEngineOptions) {
		this.canvas = opts.canvas;
		this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
		this.host = opts.host;
		this.textEl = opts.textEl;
		this.spaceEl = opts.spaceEl;
		this.tokens = opts.tokens;
		this.reduced = opts.reduced;
	}

	setTheme(tokens: Tokens): void {
		this.tokens = tokens;
	}

	setReduced(reduced: boolean): void {
		this.reduced = reduced;
		if (reduced) this.ripple = null;
		else if (this.cols && this.rows) this.ripple = this.freshRippleBuffers();
	}

	isSettled(): boolean {
		// An ambient loop runs for as long as it's visible; only reduced
		// motion's single static frame counts as "settled" (design D15).
		return this.reduced;
	}

	destroy(): void {}

	private freshRippleBuffers() {
		const size = this.cols * this.rows;
		return { current: new Float32Array(size), previous: new Float32Array(size) };
	}

	resize(): void {
		const rect = this.canvas.getBoundingClientRect();
		if (!rect.width) return;
		this.width = rect.width;
		this.height = rect.height;

		const dpr = devicePixelRatioCapped();
		this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
		this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
		this.fontSize = rect.width < 560 ? 10 : 12;
		const font = `${this.fontSize}px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.ctx.font = font;
		this.cw = this.ctx.measureText('M').width || this.fontSize * 0.6;
		this.ch = Math.round(this.fontSize * 1.22);

		const cols = Math.max(4, Math.ceil(rect.width / this.cw));
		const rows = Math.max(2, Math.ceil(rect.height / this.ch));
		if (cols !== this.cols || rows !== this.rows) {
			this.cols = cols;
			this.rows = rows;
			this.ripple = this.reduced ? null : this.freshRippleBuffers();
		}

		this.layoutBird();
	}

	private layoutBird(): void {
		const hostRect = this.host.getBoundingClientRect();
		const spaceRect = this.spaceEl?.getBoundingClientRect() ?? null;
		// A visible "space" element (nonzero height) means the narrow, stacked
		// hero layout is active — simpler than the legacy's computed-style
		// check, and equivalent in practice (a hidden element has no box).
		const narrow = !!spaceRect && spaceRect.height > 0;

		let scale: number;
		let ax: number;
		let ay: number;
		if (narrow && spaceRect) {
			const top = spaceRect.top - hostRect.top;
			scale = Math.min((spaceRect.height - 16) / 1.75, (this.width - 24) / 2.15);
			ax = this.width - 12 - 0.8 * scale;
			ay = top + 8 + 0.8 * scale;
		} else {
			const textRect = this.textEl.getBoundingClientRect();
			const textRight = textRect.left + textRect.width - hostRect.left;
			scale = Math.min(this.height / 1.85, (this.width - 72 - textRight) / 2.12);
			ax = this.width - 20 - 0.8 * scale;
			ay = this.height / 2 - 0.095 * scale;
		}
		this.bird = { S: Math.max(scale, 60), ax, ay };
	}

	/** Adds ripple energy at a pointer/touch position, in canvas-local client coordinates. */
	poke(clientX: number, clientY: number, strength: number): void {
		if (this.reduced || !this.ripple || !this.cols) return;
		const rect = this.canvas.getBoundingClientRect();
		const cellX = Math.floor((clientX - rect.left) / this.cw);
		const cellY = Math.floor((clientY - rect.top) / this.ch);
		pokeRipple(this.ripple.current, this.cols, this.rows, cellX, cellY, strength);
	}

	draw(now: number): void {
		if (!this.cols) return;
		const t = this.reduced ? REDUCED_SEED_T : REDUCED_SEED_T + now / 1000;
		if (!this.reduced && this.ripple) {
			const { next, prev } = stepRipple(
				this.cols,
				this.rows,
				this.ripple.current,
				this.ripple.previous
			);
			this.ripple = { current: next, previous: prev };
		}

		const frame: BirdFrame = {
			...computeBirdMotion(t, this.reduced),
			...birdGeometryScale(this.ch, this.cw, this.bird.S)
		};
		const shimmer = Math.floor(t * 1.5);
		const unitX = this.cw / 3;
		const unitY = this.ch / 3;
		const heightUnits = this.height / 3;

		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);
		ctx.textBaseline = 'top';

		for (let y = 0; y < this.rows; y++) {
			const birdY = ((y + 0.5) * this.ch - this.bird.ay) / this.bird.S;
			for (let x = 0; x < this.cols; x++) {
				const birdX = ((x + 0.5) * this.cw - this.bird.ax) / this.bird.S;
				const bird = sampleBird(birdX, birdY, frame);

				let glyph: string;
				let colorKey: Parameters<typeof resolveSkyColor>[0];

				if (bird) {
					if (bird.key === 'eye') continue;
					colorKey = bird.key === 'gorget' && (x + y + shimmer) % 2 === 1 ? 'gorget2' : bird.key;
					const idx = Math.max(2, Math.round(clamp01(bird.value) * RAMP_LAST_INDEX));
					glyph = RAMP.charAt(idx);
				} else {
					let sx = x;
					let sy = y;
					let boost = 0;
					let energy = 0;
					if (this.ripple && x > 0 && y > 0 && x < this.cols - 1 && y < this.rows - 1) {
						const i = y * this.cols + x;
						const r = this.ripple.current;
						energy = r[i];
						sx += (r[i + 1] - r[i - 1]) * 1.5;
						sy += (r[i + this.cols] - r[i - this.cols]) * 1.5;
						boost = Math.min(1, Math.abs(energy) * 0.28);
					}
					const X = sx * unitX;
					const Y = sy * unitY;
					let value = cloudField(
						(px, py) => sampleTexture(this.textureA, px, py),
						(px, py) => sampleTexture(this.textureB, px, py),
						X,
						Y,
						t,
						heightUnits
					);
					value = clamp01(value + boost + ditherOffset4x4(x, y) * 0.09);
					const idx = Math.round(value * RAMP_LAST_INDEX);
					if (idx === 0) continue;
					glyph = RAMP.charAt(idx);
					if (boost > 0.35) {
						colorKey = energy > 0 ? 'hotP' : 'hotC';
					} else {
						const hueSample = sampleTexture(this.textureB, X * 0.35 + t * 1.2, Y * 0.35 + 40);
						const hue = hueSample < 0.47 ? 'c' : hueSample < 0.56 ? 'b' : 'm';
						colorKey = `${hue}${value > 0.42 ? '1' : '0'}` as Parameters<typeof resolveSkyColor>[0];
					}
				}

				ctx.fillStyle = resolveSkyColor(colorKey, this.tokens);
				ctx.fillText(glyph, x * this.cw, y * this.ch);
			}
		}
	}
}
