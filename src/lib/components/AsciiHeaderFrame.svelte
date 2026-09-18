<script lang="ts">
	/**
	 * The shared full-bleed ASCII header shell for every HYDRATED page (owner
	 * decision `site/v2-direction` slice S3, item B): the reference artifact
	 * is "a full-bleed field of characters with the name set in a large
	 * figlet overlaid on it and a pointer ripple running through the
	 * glyphs." Each page supplies its OWN canvas (wired to its own engine —
	 * `SkyEngine` for home, `BandEngine` for field, `HeaderFieldEngine` for
	 * work) as the `canvas` snippet; this component only owns the shared
	 * layout: the canvas fills the frame, the figlet title sits large and
	 * centered on top of it, `pointer-events: none` on the title so the
	 * canvas underneath still receives the pointer/touch ripple.
	 */
	import type { Snippet } from 'svelte';
	import Figlet from './Figlet.svelte';

	let { art, canvas }: { art: string; canvas: Snippet } = $props();
</script>

<div class="ascii-header" aria-hidden="true">
	{@render canvas()}
	<div class="title">
		<Figlet {art} />
	</div>
</div>

<style>
	.ascii-header {
		position: relative;
		/* design D15's motion table intent, carried into slice S3: a tall
		   "protagonist" header, not a thin strip. */
		height: clamp(180px, 26vw, 300px);
		border: 1px solid color-mix(in srgb, var(--pc, var(--cyan)) 22%, var(--line));
		border-radius: 4px;
		background: var(--banner);
		overflow: hidden;
	}
	.ascii-header :global(canvas) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
	.title {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		padding: 0 6%;
		pointer-events: none;
	}
</style>
