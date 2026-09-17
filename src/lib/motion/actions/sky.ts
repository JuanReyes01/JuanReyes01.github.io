/**
 * The hero sky action (design motion table "Sky /", owner rule: pointer
 * and touch ripple). Wires the shared canvas lifecycle to `SkyEngine`, then
 * adds the pointer/touch listeners the engine's `poke()` needs — ported
 * from the legacy hero ripple wiring. `createSkyAction` takes injected deps
 * so the interaction logic is unit-testable without a real canvas action;
 * `sky` is the production action, resolving real browser deps lazily
 * inside the function body so nothing touches the DOM during SSR.
 */
import { createCanvasAction, type CanvasActionDeps } from '../runtime/canvas-action';
import { browserCanvasActionDeps } from '../runtime/browser';
import { SkyEngine, type MeasurableElement } from '../engines/sky';

export interface SkyActionParams {
	host: HTMLElement;
	textEl: HTMLElement;
	spaceEl?: MeasurableElement | null;
}

export function createSkyAction(
	deps: CanvasActionDeps
): (node: HTMLCanvasElement, params: SkyActionParams) => { destroy(): void } {
	return (node, params) => {
		// `create()` resolves asynchronously (fonts load first), so capture
		// the live engine instance here — poke() calls before it's ready are
		// simply dropped (SkyEngine.poke also no-ops until resize() has run).
		let engine: SkyEngine | null = null;
		const attach = createCanvasAction(deps, (canvas, actionParams: SkyActionParams, env) => {
			engine = new SkyEngine({
				canvas,
				host: actionParams.host,
				textEl: actionParams.textEl,
				spaceEl: actionParams.spaceEl,
				tokens: env.tokens,
				reduced: env.reduced
			});
			return engine;
		});
		const handle = attach(node, params);

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

		params.host.addEventListener('pointermove', onPointerMove);
		params.host.addEventListener('pointerleave', onPointerLeave);
		params.host.addEventListener('pointerdown', onPointerDown);
		params.host.addEventListener('touchmove', onTouchMove, { passive: true });

		return {
			destroy() {
				params.host.removeEventListener('pointermove', onPointerMove);
				params.host.removeEventListener('pointerleave', onPointerLeave);
				params.host.removeEventListener('pointerdown', onPointerDown);
				params.host.removeEventListener('touchmove', onTouchMove);
				handle.destroy();
			}
		};
	};
}

export function sky(node: HTMLCanvasElement, params: SkyActionParams): { destroy(): void } {
	return createSkyAction(browserCanvasActionDeps())(node, params);
}
