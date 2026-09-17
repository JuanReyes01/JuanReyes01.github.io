/**
 * Wires the tested runtime abstractions (scheduler, theme watcher, reduced-
 * motion watcher, canvas action) to real browser globals. One scheduler and
 * one theme/reduced-motion watcher for the whole app (design D14) — every
 * `motion/actions/*.ts` shares this module instead of creating its own.
 * This file is intentionally untested glue; the logic it wires together is
 * fully covered in `scheduler.test.ts`, `tokens.test.ts`,
 * `reduced-motion.test.ts` and `canvas-action.test.ts`.
 */
import { createBrowserClock, Scheduler } from './scheduler';
import { createThemeWatcher } from './tokens';
import { createReducedMotionWatcher } from './reduced-motion';
import type { CanvasActionDeps } from './canvas-action';

/** The box-drawing/arrow glyphs the timeline and hero canvases draw (design D12/D14). */
const CANVAS_GLYPHS = '━┼│╰╯╮●';

export const scheduler = new Scheduler(createBrowserClock());

export const themeWatcher = createThemeWatcher({
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
});

export const reducedMotionWatcher = createReducedMotionWatcher((query) => window.matchMedia(query));

async function loadFonts(): Promise<void> {
	if (typeof document === 'undefined' || !document.fonts) return;
	await document.fonts.load('400 12px "JetBrains Mono"', CANVAS_GLYPHS);
}

function createRafCoalescedResizeObserver(onResize: () => void) {
	let frame: number | null = null;
	const observer = new ResizeObserver(() => {
		if (frame !== null) return;
		frame = requestAnimationFrame(() => {
			frame = null;
			onResize();
		});
	});
	return {
		observe: (node: HTMLCanvasElement) => observer.observe(node),
		disconnect: () => {
			observer.disconnect();
			if (frame !== null) cancelAnimationFrame(frame);
		}
	};
}

function createVisibilityObserver(onChange: (visible: boolean) => void) {
	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) onChange(entry.isIntersecting);
	});
	return {
		observe: (node: HTMLCanvasElement) => observer.observe(node),
		disconnect: () => observer.disconnect()
	};
}

/** The real browser deps for `createCanvasAction`, shared by every engine's action. */
export function browserCanvasActionDeps(): CanvasActionDeps {
	return {
		scheduler,
		themeWatcher,
		reducedMotionWatcher,
		loadFonts,
		now: () => performance.now(),
		createResizeObserver: createRafCoalescedResizeObserver,
		createIntersectionObserver: createVisibilityObserver
	};
}
