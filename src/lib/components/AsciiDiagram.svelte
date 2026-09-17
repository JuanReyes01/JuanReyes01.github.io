<script lang="ts">
	import { renderAsciiMarkup } from '$lib/domain/ascii-markup';

	let {
		art,
		caption,
		label,
		footer
	}: {
		art: string;
		caption: string;
		/** Required — makes the diagram an accessible image with a text equivalent. */
		label: string;
		footer?: string;
	} = $props();
</script>

<figure class="block">
	<figcaption class="block-bar">{caption}</figcaption>
	<div class="scroll-x">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- renderAsciiMarkup escapes HTML first, then only adds our own hl/hl2 spans -->
		<pre class="ascii raw-glyphs" aria-label={label} role="img">{@html renderAsciiMarkup(art)}</pre>
	</div>
	{#if footer}<div class="block-foot">{footer}</div>{/if}
</figure>

<style>
	.block {
		margin: 18px 0 0;
		border: 1px solid color-mix(in srgb, var(--pc, var(--cyan)) 22%, var(--line));
		border-radius: 3px;
		background: var(--banner);
	}
	.block-bar {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		padding: 6px 12px;
		border-bottom: 1px solid var(--line);
	}
	.scroll-x {
		overflow-x: auto;
	}
	.ascii {
		margin: 0;
		padding: 14px;
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		line-height: 1.3;
		color: var(--fg);
		white-space: pre;
	}
	.ascii :global(.hl) {
		color: var(--pc, var(--cyan));
		font-weight: 700;
	}
	.ascii :global(.hl2) {
		color: var(--pc2, var(--blue));
	}
	.block-foot {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		padding: 6px 12px;
		border-top: 1px solid var(--line);
	}
</style>
