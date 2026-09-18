<script lang="ts">
	/** A decorative, pre-rendered ASCII banner (design "helpers": Figlet). Purely
	    presentational — the pane title (an actual heading) already carries the
	    accessible section name, so this is `aria-hidden`.

	    Owner decision `site/v2-direction` slice S3, item B: every hydrated/
	    static header is now a full-bleed character field with this figlet
	    title "set in a large figlet overlaid on it" (reference artifact) —
	    Figlet is only ever used inside `AsciiHeaderFrame`/`StaticAsciiHeader`
	    now, so its default size is that large, prominent overlay size rather
	    than the old small pane-head banner. */
	let { art }: { art: string } = $props();
</script>

<pre class="fig raw-glyphs" aria-hidden="true">{art}</pre>

<style>
	.fig {
		margin: 0;
		font-family: var(--font-mono);
		font-size: clamp(1.3rem, 0.85rem + 3vw, 3rem);
		font-weight: 500;
		line-height: 1.1;
		color: var(--pc, var(--cyan));
		white-space: pre;
	}
	@media (max-width: 560px) {
		.fig {
			font-size: clamp(0.85rem, 0.5rem + 3vw, 1.6rem);
		}
	}
	/* F8 (sveltekit-migration apply-fix batch): legacy `.fig` (index.html)
	   clips a two-tone section-color gradient to the glyph strokes instead of
	   a flat single hue — at this banner's small size/thin strokes, the flat
	   color read as faint; the gradient (falls back to the plain `--pc`
	   color above when `background-clip: text` isn't supported) matches the
	   legacy look and reads as intentionally styled. */
	@supports (background-clip: text) or (-webkit-background-clip: text) {
		.fig {
			background-image: linear-gradient(90deg, var(--pc, var(--cyan)), var(--pc2, var(--blue)));
			-webkit-background-clip: text;
			background-clip: text;
			-webkit-text-fill-color: transparent;
			color: transparent;
		}
	}
</style>
