/**
 * The field page's iridescent band action (design motion table "Band
 * /field"; owner decision `site/v2-direction` slice S3, item B: every
 * full-bleed header — this band IS `/field/`'s header now — gets "the
 * pointer/touch ripple"). Like `actions/header-field.ts`, the header's
 * figlet overlay sits on top of the canvas with `pointer-events: none`, so
 * listeners attach directly to the canvas node — no separate host element.
 */
import { createCanvasAction, type CanvasActionDeps } from '../runtime/canvas-action';
import { browserCanvasActionDeps } from '../runtime/browser';
import { BandEngine } from '../engines/band';

export function createBandAction(
	deps: CanvasActionDeps
): (node: HTMLCanvasElement) => { destroy(): void } {
	return (node) => {
		let engine: BandEngine | null = null;
		const attach = createCanvasAction(deps, (canvas, _params, env) => {
			engine = new BandEngine({ canvas, tokens: env.tokens, reduced: env.reduced });
			return engine;
		});
		const handle = attach(node, undefined);

		let lastX: number | null = null;
		let lastY: number | null = null;

		const onPointerMove = (e: PointerEvent) => {
			const speed = lastX === null ? 0 : Math.hypot(e.clientX - lastX, e.clientY - (lastY ?? 0));
			lastX = e.clientX;
			lastY = e.clientY;
			engine?.poke(e.clientX, e.clientY, Math.min(9, 2 + speed * 0.25));
		};
		const onPointerLeave = () => {
			lastX = null;
			lastY = null;
		};
		const onPointerDown = (e: PointerEvent) => engine?.poke(e.clientX, e.clientY, 14);
		const onTouchMove = (e: TouchEvent) => {
			const touch = e.touches[0];
			if (touch) engine?.poke(touch.clientX, touch.clientY, 6);
		};

		node.addEventListener('pointermove', onPointerMove);
		node.addEventListener('pointerleave', onPointerLeave);
		node.addEventListener('pointerdown', onPointerDown);
		node.addEventListener('touchmove', onTouchMove, { passive: true });

		return {
			destroy() {
				node.removeEventListener('pointermove', onPointerMove);
				node.removeEventListener('pointerleave', onPointerLeave);
				node.removeEventListener('pointerdown', onPointerDown);
				node.removeEventListener('touchmove', onTouchMove);
				handle.destroy();
			}
		};
	};
}

export function band(node: HTMLCanvasElement): { destroy(): void } {
	// Deps are resolved inside the action body, not at module scope, so
	// nothing touches the DOM until Svelte actually mounts this action
	// (actions never run during SSR, but this module is still imported by
	// the server bundle during prerendering).
	return createBandAction(browserCanvasActionDeps())(node);
}
