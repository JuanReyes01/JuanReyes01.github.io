<script lang="ts">
	import type { Snippet } from 'svelte';
	import { scramble } from '$lib/motion/actions/scramble';
	import { isReducedMotion } from '$lib/motion/runtime/browser';

	let {
		index,
		title,
		sub,
		desc,
		href,
		lane,
		variant = 'numbered',
		scramble: scrambleEnabled = true,
		aside,
		details,
		onactivate,
		ondeactivate
	}: {
		index?: number;
		title: string;
		sub?: string;
		desc?: string;
		/** Wraps the row in a link (e.g. a work index row -> its case study). */
		href?: string;
		/** Timeline lane id (design motion table): row hover/focus tells the
		    timeline canvas action which lane to highlight via `data-lane`. */
		lane?: string;
		/** `bullet` renders a `›` glyph instead of a zero-padded number (the
		    home page's now/how-I-work index lists). */
		variant?: 'numbered' | 'bullet';
		scramble?: boolean;
		aside?: Snippet;
		/** When given, the row becomes a native `<details>`/`<summary>` (the
		    experience role rows' expandable highlights). */
		details?: Snippet;
		onactivate?: () => void;
		ondeactivate?: () => void;
	} = $props();

	const num = $derived(index !== undefined ? String(index).padStart(2, '0') : undefined);
</script>

{#snippet mainContent()}
	<span class="num">
		{#if variant === 'bullet'}
			<span aria-hidden="true">›</span>
		{:else}
			{num}
		{/if}
	</span>
	<span class="main">
		<span class="sr-only">{title}</span>
		{#if scrambleEnabled}
			<span class="title raw-glyphs" aria-hidden="true" use:scramble={{ reduced: isReducedMotion }}
				>{title}</span
			>
		{:else}
			<span class="title raw-glyphs" aria-hidden="true">{title}</span>
		{/if}
		{#if sub}<span class="sub">{sub}</span>{/if}
		{#if desc}<span class="desc">{desc}</span>{/if}
	</span>
	{#if aside}{@render aside()}{/if}
	{#if details}<span class="toggle" aria-hidden="true">+</span>{/if}
{/snippet}

<li class="row">
	{#if details}
		<details>
			<summary
				class="row-grid has-toggle"
				data-row
				data-lane={lane}
				onmouseenter={onactivate}
				onmouseleave={ondeactivate}
				onfocusin={onactivate}
				onfocusout={ondeactivate}
			>
				{@render mainContent()}
			</summary>
			<div class="more">{@render details()}</div>
		</details>
	{:else if href}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- href is caller-provided (internal case-study/route links); resolving here would require every caller to pre-resolve instead -->
		<a
			class="row-grid"
			data-row
			data-lane={lane}
			{href}
			onmouseenter={onactivate}
			onmouseleave={ondeactivate}
			onfocusin={onactivate}
			onfocusout={ondeactivate}
		>
			{@render mainContent()}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{:else}
		<!-- No href/details: a plain data row (e.g. a build's metric row, or a
		     now/how-I-work index item) with nothing to focus or hover-activate. -->
		<div class="row-grid" data-row data-lane={lane}>
			{@render mainContent()}
		</div>
	{/if}
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
		color: inherit;
		text-decoration: none;
		cursor: default;
	}
	a.row-grid {
		cursor: pointer;
	}
	summary.row-grid {
		cursor: pointer;
		list-style: none;
	}
	summary.row-grid::-webkit-details-marker {
		display: none;
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
	.toggle {
		font-family: var(--font-mono);
		color: var(--pc, var(--cyan));
		font-weight: 700;
	}
	details[open] .toggle::before {
		content: '−';
	}
	.more {
		padding: 0 8px 16px 2.6rem;
		color: var(--fg-2);
	}
	.more :global(ul) {
		margin: 0;
		padding-left: 1.1em;
	}
	.more :global(li) {
		margin: 6px 0;
	}
	[data-row]:focus,
	[data-row]:focus-visible {
		background: color-mix(in srgb, var(--pc, var(--cyan)) 12%, transparent);
		box-shadow: inset 2px 0 0 var(--pc, var(--cyan));
		outline: none;
	}
	[data-row]:focus .title,
	[data-row]:focus-visible .title {
		color: var(--pc, var(--cyan));
	}
</style>
