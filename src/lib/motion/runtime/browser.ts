/**
 * Wires the tested runtime abstractions (scheduler, theme watcher, reduced-
 * motion watcher, canvas action) to real browser globals. One scheduler and
 * one theme/reduced-motion watcher for the whole app (design D14) — every
 * `motion/actions/*.ts` shares this module instead of creating its own.
 * This file is intentionally untested glue; the logic it wires together is
 * fully covered in `scheduler.test.ts`, `tokens.test.ts`,
 * `reduced-motion.test.ts` and `canvas-action.test.ts`.
 *
 * Every singleton below is created lazily, on first use, rather than at
 * module top-level. Svelte actions (`use:sky`, etc.) are never invoked
 * during SSR, but the *modules* that define them are still imported by the
 * server bundle during prerendering — eagerly calling `window.matchMedia`
 * or `getComputedStyle` at import time would crash the build. Lazy getters
 * keep this module side-effect-free until an action actually runs client-side.
 */
import { createBrowserClock, Scheduler } from './scheduler';
import { createThemeWatcher, type ThemeWatcher } from './tokens';
import { createReducedMotionWatcher, type ReducedMotionWatcher } from './reduced-motion';
import type { CanvasActionDeps } from './canvas-action';

/**
 * Every box-drawing/arrow/shape glyph the sky, timeline and band engines
 * draw via the box-drawing font subset (design D12/D14) — grepped from
 * `domain/git-graph.ts` (`━ ─ │ ┼ ┬ ┴ ╰ ╯ ╮ ●`) and `motion/engines/*`
 * (`◉` in `timeline-visuals.ts`, `▼` in `timeline.ts`). All at weight 400,
 * the only weight any canvas `ctx.font` string in this app requests (R4).
 */
const CANVAS_GLYPHS = '━─│┼┬┴╰╯╮●◉▼';

let sharedScheduler: Scheduler | null = null;
function getScheduler(): Scheduler {
	return (sharedScheduler ??= new Scheduler(createBrowserClock()));
}

let sharedThemeWatcher: ThemeWatcher | null = null;
function getThemeWatcher(): ThemeWatcher {
	return (sharedThemeWatcher ??= createThemeWatcher({
		readVar: (name) => getComputedStyle(document.documentElement).getPropertyValue(name),
		matchDarkScheme: () => window.matchMedia('(prefers-color-scheme: dark)'),
		observeAttribute: (onChange) => {
			const observer = new MutationObserver(onChange);
			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['data-theme']
			});
			return () => observer.disconnect();
		}
	}));
}

let sharedReducedMotionWatcher: ReducedMotionWatcher | null = null;
function getReducedMotionWatcher(): ReducedMotionWatcher {
	return (sharedReducedMotionWatcher ??= createReducedMotionWatcher((query) =>
		window.matchMedia(query)
	));
}

/**
 * Loads the box-drawing glyph subset before the first frame draws. A failed
 * webfont fetch must not block the canvas from rendering (R5) — it just
 * falls back to the font stack's next entry (`ui-monospace`, `Menlo`, ...),
 * which every engine's font string already declares.
 */
export async function loadFonts(): Promise<void> {
	if (typeof document === 'undefined' || !document.fonts) return;
	try {
		await document.fonts.load('400 12px "JetBrains Mono"', CANVAS_GLYPHS);
	} catch {
		// Draw anyway with the fallback font — see doc comment above.
	}
}

/**
 * Re-fires `onChange` when `devicePixelRatio` crosses a value (R5). A plain
 * `ResizeObserver` does not fire when only the device pixel ratio changes
 * without a CSS-pixel size change (e.g. dragging a window between displays
 * with different pixel densities), which would leave a canvas's backing
 * store at the wrong resolution until some unrelated resize happened to fire.
 */
export function watchDevicePixelRatio(onChange: () => void): () => void {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return () => {};
	}
	let unsubscribeCurrent: () => void = () => {};
	const subscribe = () => {
		const dpr = window.devicePixelRatio || 1;
		const mql = window.matchMedia(`(resolution: ${dpr}dppx)`);
		const handler = () => {
			unsubscribeCurrent(); // detach this now-crossed query before attaching the next one
			onChange();
			subscribe(); // re-subscribe at the new DPR so the next crossing still fires
		};
		mql.addEventListener('change', handler);
		unsubscribeCurrent = () => mql.removeEventListener('change', handler);
	};
	subscribe();
	return () => unsubscribeCurrent();
}

function createRafCoalescedResizeObserver(onResize: () => void) {
	let frame: number | null = null;
	const scheduleResize = () => {
		if (frame !== null) return;
		frame = requestAnimationFrame(() => {
			frame = null;
			onResize();
		});
	};
	const observer = new ResizeObserver(scheduleResize);
	const unwatchDpr = watchDevicePixelRatio(scheduleResize);
	return {
		observe: (node: HTMLCanvasElement) => observer.observe(node),
		disconnect: () => {
			observer.disconnect();
			unwatchDpr();
			if (frame !== null) cancelAnimationFrame(frame);
		}
	};
}

/** Thresholds `[0, 0.5]` (R1) so callers get both a coarse visible/invisible
 * flag (any overlap) and the finer ratio an engine needs to know when it has
 * crossed 50% visible (e.g. the timeline's "start the intro" trigger). */
export function createVisibilityObserver(onChange: (visible: boolean, ratio: number) => void) {
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) onChange(entry.isIntersecting, entry.intersectionRatio);
		},
		{ threshold: [0, 0.5] }
	);
	return {
		observe: (node: HTMLCanvasElement) => observer.observe(node),
		disconnect: () => observer.disconnect()
	};
}

/** The real browser deps for `createCanvasAction`, shared by every engine's action. */
export function browserCanvasActionDeps(): CanvasActionDeps {
	return {
		scheduler: getScheduler(),
		themeWatcher: getThemeWatcher(),
		reducedMotionWatcher: getReducedMotionWatcher(),
		loadFonts,
		now: () => performance.now(),
		createResizeObserver: createRafCoalescedResizeObserver,
		createIntersectionObserver: createVisibilityObserver
	};
}
