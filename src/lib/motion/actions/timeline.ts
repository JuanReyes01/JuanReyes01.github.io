/**
 * The experience timeline action (design D16, owner rule: "pointer
 * hover/drag (and touch) scrubs; arrow keys + Home/End scrub only while
 * the canvas is focused"). Wires the shared canvas lifecycle to
 * `TimelineEngine`, then ports the legacy pointer/keyboard scrub wiring.
 * `focusLane(id)` is exposed on the action handle for row hover/focus to
 * call — the actual row markup and a11y attributes (`role="slider"`, etc.)
 * land in PR5. `createTimelineAction` takes injected deps so the
 * interaction logic is unit-tested without a real canvas action.
 */
import { createCanvasAction, type CanvasActionDeps } from '../runtime/canvas-action';
import { browserCanvasActionDeps } from '../runtime/browser';
import { TimelineEngine } from '../engines/timeline';
import type { Timeline } from '../../domain/types';
import type { Readout } from '../../domain/readout';

export interface TimelineActionParams {
	timeline: Timeline;
	onReadout?: (readout: Readout) => void;
}

export interface TimelineActionHandle {
	/** Row hover/focus calls this to highlight a lane and scrub to its start (design motion table). */
	focusLane(id: string | null): void;
	destroy(): void;
}

const SCRUB_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

export function createTimelineAction(
	deps: CanvasActionDeps
): (node: HTMLCanvasElement, params: TimelineActionParams) => TimelineActionHandle {
	return (node, params) => {
		let engine: TimelineEngine | null = null;
		const attach = createCanvasAction(deps, (canvas, actionParams: TimelineActionParams, env) => {
			engine = new TimelineEngine({
				canvas,
				timeline: actionParams.timeline,
				tokens: env.tokens,
				reduced: env.reduced,
				now: deps.now,
				wake: env.wake,
				onReadout: actionParams.onReadout
			});
			return engine;
		});
		const handle = attach(node, params);

		const scrubToClientX = (clientX: number) => {
			if (!engine) return;
			engine.scrub(engine.monthAtClientX(clientX) + 0.5);
		};

		const onPointerMove = (e: PointerEvent) => scrubToClientX(e.clientX);
		const onPointerDown = (e: PointerEvent) => {
			node.setPointerCapture?.(e.pointerId);
			scrubToClientX(e.clientX);
		};
		const onPointerLeave = () => engine?.release();
		const onPointerUp = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') engine?.release();
		};
		const onBlur = () => engine?.release();
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			if (!SCRUB_KEYS.has(e.key)) return;
			e.preventDefault();
			engine?.key(e.key);
		};

		node.addEventListener('pointermove', onPointerMove);
		node.addEventListener('pointerdown', onPointerDown);
		node.addEventListener('pointerleave', onPointerLeave);
		node.addEventListener('pointerup', onPointerUp);
		node.addEventListener('blur', onBlur);
		node.addEventListener('keydown', onKeyDown);

		return {
			focusLane(id) {
				engine?.setFocusLane(id);
			},
			destroy() {
				node.removeEventListener('pointermove', onPointerMove);
				node.removeEventListener('pointerdown', onPointerDown);
				node.removeEventListener('pointerleave', onPointerLeave);
				node.removeEventListener('pointerup', onPointerUp);
				node.removeEventListener('blur', onBlur);
				node.removeEventListener('keydown', onKeyDown);
				handle.destroy();
			}
		};
	};
}

export function timeline(
	node: HTMLCanvasElement,
	params: TimelineActionParams
): TimelineActionHandle {
	return createTimelineAction(browserCanvasActionDeps())(node, params);
}
