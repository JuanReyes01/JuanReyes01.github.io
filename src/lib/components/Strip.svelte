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
	 */
	import { stripDots } from '$lib/motion/fields/strip';

	let { cols = 48, rows = 10 }: { cols?: number; rows?: number } = $props();

	const grid = $derived(stripDots(cols, rows));
</script>

<svg
	class="strip"
	viewBox="0 0 {cols} {rows}"
	preserveAspectRatio="none"
	aria-hidden="true"
	focusable="false"
>
	{#each grid as row, y (y)}
		{#each row as lit, x (x)}
			{#if lit}
				<rect class="dot" {x} {y} width="1" height="1" />
			{/if}
		{/each}
	{/each}
</svg>

<style>
	.strip {
		display: block;
		width: 100%;
		height: 100%;
		min-width: 0;
	}
	.dot {
		fill: var(--pc, var(--cyan));
	}
</style>
