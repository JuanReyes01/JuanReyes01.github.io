<script lang="ts">
	import type { Snippet } from 'svelte';

	// Numbered variant only (this batch's scope). The `href` (work
	// case-study links) and `details` (timeline expand/collapse) variants
	// from the design's Row contract are deferred to the PR that actually
	// renders that content (Phase 3/5) — building them unexercised here
	// would add unverified surface area for no current caller.
	let {
		index,
		title,
		sub,
		desc,
		aside
	}: {
		index: number;
		title: string;
		sub?: string;
		desc?: string;
		aside?: Snippet;
	} = $props();

	const num = $derived(String(index).padStart(2, '0'));
</script>

<li class="row">
	<div class="row-grid" data-row>
		<span class="num">{num}</span>
		<span class="main">
			<span class="sr-only">{title}</span>
			<span class="title raw-glyphs" aria-hidden="true">{title}</span>
			{#if sub}<span class="sub">{sub}</span>{/if}
			{#if desc}<span class="desc">{desc}</span>{/if}
		</span>
		{#if aside}{@render aside()}{/if}
	</div>
</li>

<style>
	.row {
		border-bottom: 1px solid var(--line);
		list-style: none;
	}
	.row-grid {
		display: grid;
		grid-template-columns: 2.6rem minmax(0, 1fr) auto;
		column-gap: 14px;
		align-items: baseline;
		padding: 13px 8px;
	}
	.num {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.title {
		font-family: var(--font-mono);
		font-size: 0.98rem;
		font-weight: 500;
		color: var(--fg);
	}
	.sub {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.74rem;
		color: var(--muted);
		margin-top: 3px;
	}
	.desc {
		display: block;
		color: var(--fg-2);
		font-size: var(--fs-md);
		margin-top: 6px;
		max-width: 64ch;
	}
	[data-row]:focus {
		background: color-mix(in srgb, var(--pc, var(--cyan)) 12%, transparent);
		box-shadow: inset 2px 0 0 var(--pc, var(--cyan));
		outline: none;
	}
	[data-row]:focus .title {
		color: var(--pc, var(--cyan));
	}
</style>
