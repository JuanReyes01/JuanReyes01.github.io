<script lang="ts">
	/**
	 * A static, decorative pane-header dither strip (design "helpers", owner
	 * request R2). Reuses the same field-sampling code as the `/field` band
	 * (`motion/fields/strip.ts`) but renders ONE fixed frame as inline SVG
	 * markup — never a `<canvas>`, never registered with the shared
	 * scheduler — so it needs zero client JS and can render on `csr:false`
	 * routes (`/work/`) exactly like AsciiDiagram or Row already do. Colors
	 * every lit dot with the current section's `--pc` accent (set by the
	 * `[data-section]` rule in `styles/tokens.css`), so it never needs a
	 * `section` prop of its own.
	 *
	 * Defaults sample a real dither resolution (legacy's pane-header `Strip`
	 * used `cell = 2` CSS px; at a typical ~600x60 header row that's ~300x30
	 * cells) instead of a coarse handful — a coarse grid stretched into
	 * ~12px blocky squares once scaled up to a real header's size, nothing
	 * like the legacy texture. Every dot is emitted into ONE `<path>` (not
	 * one `<rect>` per dot) so the element count stays flat regardless of
	 * grid resolution.
	 *
	 * Responsive strategy: a FIXED viewBox with `preserveAspectRatio="xMidYMid
	 * slice"` (not `"none"`, which stretches cells into rectangles). `slice`
	 * scales the pattern uniformly to fully cover whatever box CSS gives this
	 * SVG, cropping the overflow on whichever axis runs long — dots stay
	 * perfectly square at every viewport width, matching how the `/field`
	 * band already fills its box edge-to-edge.
	 */
	import { stripPath } from '$lib/motion/fields/strip';

	let { cols = 300, rows = 30 }: { cols?: number; rows?: number } = $props();

	const d = $derived(stripPath(cols, rows));
</script>

<svg
	class="strip"
	viewBox="0 0 {cols} {rows}"
	preserveAspectRatio="xMidYMid slice"
	shape-rendering="crispEdges"
	aria-hidden="true"
	focusable="false"
>
	<path class="dot" {d} />
</svg>

<style>
	.strip {
		display: block;
		width: 100%;
		height: 100%;
		min-width: 0;
		overflow: hidden;
	}
	.dot {
		fill: var(--pc, var(--cyan));
	}
</style>
