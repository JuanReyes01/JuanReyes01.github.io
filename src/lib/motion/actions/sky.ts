/**
 * The hero sky action (design motion table "Sky /", owner rule: pointer
 * and touch ripple). Wires the shared canvas lifecycle to `SkyEngine`, then
 * adds the pointer/touch listeners the engine's `poke()` needs — ported
 * from the legacy hero ripple wiring. `createSkyAction` takes injected deps
 * so the interaction logic is unit-testable without a real canvas action;
 * `sky` is the production action, resolving real browser deps lazily
 * inside the function body so nothing touches the DOM during SSR.
 *
 * `textEl`/`spaceEl` used to also feed the hero hummingbird's DOM-relative
 * layout math; now that the bird lives on `/field/` (design #4938 slice S2),
 * this action only needs a `host` to attach the ripple's pointer/touch
 * listeners to.
 */
import { createCanvasAction, type CanvasActionDeps } from '../runtime/canvas-action';
import { browserCanvasActionDeps } from '../runtime/browser';
import { SkyEngine } from '../engines/sky';

export interface SkyActionParams {
	host: HTMLElement;
}

export function createSkyAction(
	deps: CanvasActionDeps
): (
	node: HTMLCanvasElement,
	params: SkyActionParams
) => { update(params: SkyActionParams): void; destroy(): void } {
	return (node, initialParams) => {
		// F1 (sveltekit-migration apply-fix batch): in Svelte 5, this action's
		// `host` param can still be `undefined` on the canvas's first
		// synchronous mount (the parent's `bind:this` for `.hero` hasn't
		// resolved yet at that exact instant) — `node` (the canvas itself) IS
		// already attached to the document by the time an action runs, so
		// walking up to its nearest `.hero` ancestor is a deterministic
		// fallback that doesn't depend on sibling `bind:this` timing at all.
		const resolveParams = (params: SkyActionParams): SkyActionParams => {
			const host = params.host ?? (node.closest('.hero') as HTMLElement | null) ?? undefined;
			return { host: host as HTMLElement };
		};

		// `create()` resolves asynchronously (fonts load first), so capture
		// the live engine instance here — poke() calls before it's ready are
		// simply dropped (SkyEngine.poke also no-ops until resize() has run).
		let engine: SkyEngine | null = null;
		const attach = createCanvasAction(deps, (canvas, _actionParams: SkyActionParams, env) => {
			engine = new SkyEngine({ canvas, tokens: env.tokens, reduced: env.reduced });
			return engine;
		});
		let resolvedParams = resolveParams(initialParams);
		const handle = attach(node, resolvedParams);

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

		// `attachedHost` tracks whichever host element listeners are currently
		// bound to (none, at first, if even the `.hero` fallback above found
		// nothing) so `update()` can still attach once a real host shows up —
		// belt-and-braces alongside the DOM-query fallback.
		let attachedHost: HTMLElement | null = null;
		const attachHostListeners = (host: HTMLElement) => {
			host.addEventListener('pointermove', onPointerMove);
			host.addEventListener('pointerleave', onPointerLeave);
			host.addEventListener('pointerdown', onPointerDown);
			host.addEventListener('touchmove', onTouchMove, { passive: true });
			attachedHost = host;
		};
		const detachHostListeners = () => {
			if (!attachedHost) return;
			attachedHost.removeEventListener('pointermove', onPointerMove);
			attachedHost.removeEventListener('pointerleave', onPointerLeave);
			attachedHost.removeEventListener('pointerdown', onPointerDown);
			attachedHost.removeEventListener('touchmove', onTouchMove);
			attachedHost = null;
		};

		if (resolvedParams.host) attachHostListeners(resolvedParams.host);

		return {
			update(nextParams: SkyActionParams) {
				resolvedParams = resolveParams(nextParams);
				handle.update?.(resolvedParams);
				if (resolvedParams.host !== attachedHost) {
					detachHostListeners();
					if (resolvedParams.host) attachHostListeners(resolvedParams.host);
				}
			},
			destroy() {
				detachHostListeners();
				handle.destroy();
			}
		};
	};
}

export function sky(node: HTMLCanvasElement, params: SkyActionParams): { destroy(): void } {
	return createSkyAction(browserCanvasActionDeps())(node, params);
}
