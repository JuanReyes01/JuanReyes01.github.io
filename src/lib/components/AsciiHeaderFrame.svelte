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
		<div class="title-veil">
			<Figlet {art} />
		</div>
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
		align-items: flex-start;
		justify-content: flex-start;
		padding: 5% 6%;
		pointer-events: none;
	}
	/* Coordinator correction (site/v2-direction slice S3, apply-fix round
	   1): a full-size figlet (Figlet's own default, tuned for the small
	   number of home's hero-figlet characters) spans nearly the whole
	   header width at this font size, leaving the bird on /field/ nowhere
	   to be "the star" without the title's veil covering it. A smaller,
	   corner-anchored title (top-left, like a title card) leaves the rest
	   of the frame free for the field's own protagonist (the bird on
	   /field/, the header field's texture on /work/). */
	.title-veil :global(.fig) {
		font-size: clamp(0.85rem, 0.5rem + 1.8vw, 1.7rem);
	}
	/* Coordinator correction (site/v2-direction slice S3, apply-fix round
	   1): "the big title must NOT be composited into the character field...
	   keep the figlet as crisp TEXT sitting on top of the field... with
	   enough contrast (a veil or a text shadow) to stay readable in both
	   themes." A radial veil (the same --veil token the home hero's own
	   text panel uses) sits behind the title only, fading out at its edges
	   so the field is still visible everywhere else. */
	.title-veil {
		padding: 14px 26px;
		border-radius: 8px;
		background: radial-gradient(
			ellipse at center,
			var(--veil) 0%,
			var(--veil) 55%,
			transparent 100%
		);
	}
	/* A 5-letter figlet word is inherently wide (each letter is several
	   monospace columns) — at narrow (mobile) widths, `clamp()`'s own rem
	   floor above still spans nearly the full frame, leaving the header's
	   OTHER protagonist (the bird on /field/) no room at all. Shrink harder
	   here specifically. */
	@media (max-width: 480px) {
		.title-veil :global(.fig) {
			font-size: 0.5rem;
		}
		.title-veil {
			padding: 8px 14px;
		}
	}
</style>
