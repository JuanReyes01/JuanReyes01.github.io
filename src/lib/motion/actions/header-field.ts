/**
 * The generic page-header action (owner decision `site/v2-direction` slice
 * S3, item B). Unlike the hero sky action, the header's decorative figlet
 * overlay sits on top of the canvas with `pointer-events: none` (design:
 * the overlay is `aria-hidden`, purely visual), so pointer/touch listeners
 * can attach directly to the canvas node itself — no separate host element
 * or `.hero`-ancestor fallback needed.
 */
import { createCanvasAction, type CanvasActionDeps } from '../runtime/canvas-action';
import { browserCanvasActionDeps } from '../runtime/browser';
import { HeaderFieldEngine } from '../engines/header-field';
import type { Section } from '../../site';

export interface HeaderFieldActionParams {
	section: Section;
}

export function createHeaderFieldAction(
	deps: CanvasActionDeps
): (
	node: HTMLCanvasElement,
	params: HeaderFieldActionParams
) => { update(params: HeaderFieldActionParams): void; destroy(): void } {
	return (node, initialParams) => {
		let engine: HeaderFieldEngine | null = null;
		const attach = createCanvasAction(deps, (canvas, params: HeaderFieldActionParams, env) => {
			engine = new HeaderFieldEngine({
				canvas,
				tokens: env.tokens,
				reduced: env.reduced,
				section: params.section
			});
			return engine;
		});
		const handle = attach(node, initialParams);

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
			update(nextParams: HeaderFieldActionParams) {
				handle.update?.(nextParams);
			},
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

export function headerField(
	node: HTMLCanvasElement,
	params: HeaderFieldActionParams
): { destroy(): void } {
	return createHeaderFieldAction(browserCanvasActionDeps())(node, params);
}
