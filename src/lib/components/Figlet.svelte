<script lang="ts">
	/** A decorative, pre-rendered ASCII banner (design "helpers": Figlet). Purely
	    presentational — the pane title (an actual heading) already carries the
	    accessible section name, so this is `aria-hidden`. */
	let { art }: { art: string } = $props();
</script>

<pre class="fig raw-glyphs" aria-hidden="true">{art}</pre>

<style>
	.fig {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 500;
		line-height: 1.15;
		color: var(--pc, var(--cyan));
		white-space: pre;
	}
	/* Apply-fix batch (owner request R2): longer headers ("EXPERIENCE") ran
	   the full width of a narrow pane at the fixed 0.6rem size, leaving the
	   pane-head's `minmax(0, 1fr)` strip column nothing to render into. The
	   figlet itself must scale down before that happens — the strip must stay
	   visible next to it, and neither may ever force horizontal page scroll. */
	@media (max-width: 760px) {
		.fig {
			font-size: 0.44rem;
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
