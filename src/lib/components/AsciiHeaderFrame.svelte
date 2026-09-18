<script lang="ts">
	/**
	 * The shared full-bleed ASCII header shell for every HYDRATED page
	 * (approved header prototype, studies 2 & 3 — work/field: a full-bleed
	 * field of characters with a SMALL figlet title card top-left over a
	 * veil, pointer/touch ripple running through the glyphs underneath).
	 * Each page supplies its OWN canvas (wired to its own engine —
	 * `SkyEngine` for home, `BandEngine` for field, `WaveformEngine` for
	 * work) as the `canvas` snippet; this component only owns the shared
	 * layout: the canvas fills the frame, the title card sits top-left over
	 * it, `pointer-events: none` on the title so the canvas underneath still
	 * receives the pointer/touch ripple.
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
	/* Approved header prototype: a genuinely SMALL title card (9-15px, in
	   absolute px, not rem) — ported verbatim from the prototype's own
	   `.fig` rule. A rem-based clamp still reads as "a small banner" next to
	   a five-letter figlet's inherent width (each letter is several
	   monospace columns); this is small enough that the field itself (the
	   bird on /field/, the wave on /work/) is unmistakably the frame's own
	   protagonist, with the title reading as a corner label. */
	.title-veil :global(.fig) {
		font-size: clamp(9px, 1.4vw, 15px);
		font-weight: 700;
	}
	/* Prototype `.title-card`: a solid veil panel with a thin section-tinted
	   border, not a radial fade — at this small a size the title reads as an
	   actual card, not a watermark that needs to fade into the field. */
	.title-veil {
		padding: 10px 14px;
		border-radius: 4px;
		border: 1px solid color-mix(in srgb, var(--pc, var(--cyan)) 28%, var(--line));
		background: var(--veil);
	}
</style>
