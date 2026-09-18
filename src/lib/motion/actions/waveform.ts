/**
 * The `/work/` waveform action (owner decision `site/v2-direction` slice
 * S3, item D). Wires the shared canvas lifecycle to `WaveformEngine`, then
 * a pointer/touch listener for the 1D deform, plus `setSignature`/
 * `resetSignature` on the handle for a build row's hover/focus to call
 * (mirrors `actions/timeline.ts`'s `focusLane` — the row lists drive the
 * canvas, not the other way around). `setSignature`/`resetSignature` calls
 * that arrive before the engine exists (fonts still loading) are simply
 * dropped, same as `SkyEngine.poke()`'s own documented no-op-until-ready
 * behavior.
 */
import { createCanvasAction, type CanvasActionDeps } from '../runtime/canvas-action';
import { browserCanvasActionDeps } from '../runtime/browser';
import { WaveformEngine } from '../engines/waveform';
import type { WaveSignature, PaletteTokenPair } from '../fields/waveform';
import type { Section } from '../../site';

export interface WaveformActionParams {
	section: Section;
}

export interface WaveformActionHandle {
	setSignature(signature: WaveSignature): void;
	resetSignature(): void;
	/** Companion to `setSignature` — same seed, via `deriveBuildPalette`
	 * (`fields/waveform.ts`) — so a build's shape and color change together. */
	setPalette(pair: PaletteTokenPair): void;
	resetPalette(): void;
	destroy(): void;
}

export function createWaveformAction(
	deps: CanvasActionDeps
): (node: HTMLCanvasElement, params: WaveformActionParams) => WaveformActionHandle {
	return (node, initialParams) => {
		let engine: WaveformEngine | null = null;
		// The engine is only built once `loadFonts()` resolves — a real font
		// fetch in a browser. `/work/[slug]/` sets its build's own signature
		// and palette synchronously on mount, well before that, so those calls
		// are held here and replayed into the engine the moment it exists.
		// Without this every case study drew the DEFAULT waveform in the
		// DEFAULT colours, and the per-build identity never reached the page.
		let pendingSignature: WaveSignature | null = null;
		let pendingPair: PaletteTokenPair | null = null;
		const attach = createCanvasAction(deps, (canvas, params: WaveformActionParams, env) => {
			engine = new WaveformEngine({
				canvas,
				tokens: env.tokens,
				reduced: env.reduced,
				section: params.section
			});
			if (pendingSignature) engine.setSignature(pendingSignature);
			if (pendingPair) engine.setPalette(pendingPair);
			pendingSignature = null;
			pendingPair = null;
			return engine;
		});
		const handle = attach(node, initialParams);

		const onPointerMove = (e: PointerEvent) => engine?.poke(e.clientX, 4);
		const onPointerDown = (e: PointerEvent) => engine?.poke(e.clientX, 10);
		const onTouchMove = (e: TouchEvent) => {
			const touch = e.touches[0];
			if (touch) engine?.poke(touch.clientX, 6);
		};

		node.addEventListener('pointermove', onPointerMove);
		node.addEventListener('pointerdown', onPointerDown);
		node.addEventListener('touchmove', onTouchMove, { passive: true });

		return {
			setSignature(signature) {
				if (engine) engine.setSignature(signature);
				else pendingSignature = signature;
			},
			resetSignature() {
				pendingSignature = null;
				engine?.resetSignature();
			},
			setPalette(pair) {
				if (engine) engine.setPalette(pair);
				else pendingPair = pair;
			},
			resetPalette() {
				pendingPair = null;
				engine?.resetPalette();
			},
			destroy() {
				node.removeEventListener('pointermove', onPointerMove);
				node.removeEventListener('pointerdown', onPointerDown);
				node.removeEventListener('touchmove', onTouchMove);
				handle.destroy();
			}
		};
	};
}

export function waveform(
	node: HTMLCanvasElement,
	params: WaveformActionParams
): WaveformActionHandle {
	return createWaveformAction(browserCanvasActionDeps())(node, params);
}
