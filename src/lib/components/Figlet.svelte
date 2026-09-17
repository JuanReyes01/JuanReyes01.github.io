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
		line-height: 1.15;
		color: var(--pc, var(--cyan));
		white-space: pre;
	}
</style>
