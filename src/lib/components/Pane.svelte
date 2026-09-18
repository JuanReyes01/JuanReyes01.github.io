<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Section } from '$lib/site';

	let {
		id,
		title,
		index,
		meta,
		section,
		headingLevel = 2,
		nested = false,
		head,
		children
	}: {
		/** Stable id for this pane; becomes `{id}-title` for aria-labelledby. */
		id: string;
		title: string;
		index?: number;
		meta?: string;
		section?: Section;
		headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
		nested?: boolean;
		head?: Snippet;
		children: Snippet;
	} = $props();

	const titleId = $derived(`${id}-title`);
</script>

<section class="pane" class:nested data-section={section} aria-labelledby={titleId}>
	<svelte:element this={'h' + headingLevel} class="pane-title raw-glyphs" id={titleId}>
		{#if index !== undefined}<span class="k" aria-hidden="true">[{index}]</span>{/if}
		<span class="ttl">{title}</span>
	</svelte:element>
	{#if meta}<span class="pane-meta raw-glyphs" aria-hidden="true">{meta}</span>{/if}
	{#if head}<div class="pane-head">{@render head()}</div>{/if}
	{@render children()}
</section>

<style>
	.pane {
		position: relative;
		min-width: 0;
		border: 1px solid color-mix(in srgb, var(--pc, var(--cyan)) 30%, var(--line));
		border-radius: 6px;
		padding: 24px 18px 18px;
		background: var(--bg);
	}
	.pane.nested {
		padding: 20px 10px 10px;
	}
	.pane-title {
		position: absolute;
		top: 0;
		left: 12px;
		transform: translateY(-50%);
		margin: 0;
		padding: 0 6px;
		background: var(--bg);
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		font-weight: 700;
		line-height: 1.3;
		color: var(--pc, var(--cyan));
		white-space: nowrap;
	}
	.pane-title .k {
		color: var(--muted);
		font-weight: 500;
	}
	.pane-meta {
		position: absolute;
		top: 0;
		right: 12px;
		transform: translateY(-50%);
		padding: 0 6px;
		background: var(--bg);
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		line-height: 1.3;
		color: var(--muted);
		white-space: nowrap;
	}
	/* Owner decision site/v2-direction slice S3, item B: every hydrated/
	   static header (AsciiHeaderFrame / StaticAsciiHeader) is now the ONLY
	   `head` child and must claim the pane's FULL width — previously this
	   was a 2-column grid (figlet + a `Strip` decoration beside it); with
	   Strip deleted, a leftover `auto` column collapsed to the (zero)
	   intrinsic width of the header's absolutely-positioned children. */
	.pane-head {
		display: block;
		margin-bottom: 16px;
	}
</style>
