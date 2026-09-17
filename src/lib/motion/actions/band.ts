/**
 * The field page's iridescent band action (design motion table "Band
 * /field"). Thin wiring: the shared canvas lifecycle plus `BandEngine` — no
 * extra interaction, so there's nothing here beyond what
 * `canvas-action.test.ts` and `band.test.ts` already cover. Page wiring
 * (mounting the canvas under `/field`) lands in PR5.
 */
import { createCanvasAction } from '../runtime/canvas-action';
import { browserCanvasActionDeps } from '../runtime/browser';
import { BandEngine } from '../engines/band';

export function band(node: HTMLCanvasElement): { destroy(): void } {
	// Deps are resolved inside the action body, not at module scope, so
	// nothing touches the DOM until Svelte actually mounts this action
	// (actions never run during SSR, but this module is still imported by
	// the server bundle during prerendering).
	const attach = createCanvasAction(
		browserCanvasActionDeps(),
		(canvas, _params, env) => new BandEngine({ canvas, tokens: env.tokens, reduced: env.reduced })
	);
	return attach(node, undefined);
}
