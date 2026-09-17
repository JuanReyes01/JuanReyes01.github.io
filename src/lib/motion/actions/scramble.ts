/**
 * Row text scramble on hover/focus (design-system, ported from the legacy
 * `scramble()`): the sr-only copy already lives in the DOM (Row.svelte
 * renders it), so this action only needs to mark its own node
 * `aria-hidden` and drive the reveal animation on the closest `[data-row]`
 * ancestor's `mouseenter`/`focusin` — `focusin` (not the legacy's
 * non-bubbling `focus`) so it fires for any focusable descendant, matching
 * the row-focus pattern already used elsewhere on this site.
 */
const GLYPHS = '!<>-_\\/[]{}=+*^?#░▒▓01';
/** How many animation frames it takes to reveal one more character. */
const FRAMES_PER_CHAR = 1.4;

export interface ScrambleParams {
	/** Reduced motion makes this a no-op — the scrambled text never appears. */
	reduced?: () => boolean;
	requestFrame?: (callback: () => void) => number;
	cancelFrame?: (id: number) => void;
}

export interface ScrambleHandle {
	destroy(): void;
}

function randomGlyph(): string {
	return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
}

export function scramble(node: HTMLElement, params: ScrambleParams = {}): ScrambleHandle {
	const text = node.textContent ?? '';
	node.setAttribute('aria-hidden', 'true');

	const requestFrame = params.requestFrame ?? ((cb) => requestAnimationFrame(cb));
	const cancelFrame = params.cancelFrame ?? ((id) => cancelAnimationFrame(id));
	const row = node.closest('[data-row]');

	let busy = false;
	let frameId: number | null = null;

	function step(frame: number): void {
		const revealed = frame / FRAMES_PER_CHAR;
		let out = '';
		for (let i = 0; i < text.length; i++) {
			const ch = text.charAt(i);
			out += ch === ' ' || i < revealed ? ch : randomGlyph();
		}
		node.textContent = out;

		if (revealed < text.length) {
			frameId = requestFrame(() => step(frame + 1));
		} else {
			node.textContent = text;
			busy = false;
			frameId = null;
		}
	}

	function run(): void {
		if (busy || params.reduced?.()) return;
		busy = true;
		step(0);
	}

	row?.addEventListener('mouseenter', run);
	row?.addEventListener('focusin', run);

	return {
		destroy() {
			row?.removeEventListener('mouseenter', run);
			row?.removeEventListener('focusin', run);
			if (frameId !== null) cancelFrame(frameId);
			if (busy) {
				node.textContent = text;
				busy = false;
				frameId = null;
			}
		}
	};
}
