<script lang="ts">
	import Pane from '$lib/components/Pane.svelte';
	import Row from '$lib/components/Row.svelte';
	import AsciiDiagram from '$lib/components/AsciiDiagram.svelte';
	import AsciiHeaderFrame from '$lib/components/AsciiHeaderFrame.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { band } from '$lib/motion/actions/band';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const FIG = `_____ ___ _____ _     ____
|  ___|_ _| ____| |   |  _ \\
| |_   | ||  _| | |   | | | |
|  _|  | || |___| |___| |_| |
|_|   |___|_____|_____|____/`;
</script>

<SeoHead
	title="Field — Juan Camilo Reyes"
	description="Software and electronics for Centro de Investigación Colibrí Gorriazul, a hummingbird research center in Fusagasugá, Cundinamarca."
	path="/field/"
/>

<Pane id="field" index={3} title="field" section="field" meta="fusagasugá, co" headingLevel={1}>
	{#snippet head()}
		<AsciiHeaderFrame art={FIG}>
			{#snippet canvas()}
				<canvas use:band></canvas>
			{/snippet}
		</AsciiHeaderFrame>
	{/snippet}

	<!-- eslint-disable-next-line svelte/no-at-html-tags -- server-rendered from src/content/pages/field.md via the validated markdown pipeline, not user input -->
	<div class="prose">{@html data.bodyHtml}</div>

	<AsciiDiagram
		art={data.diagram.art}
		caption={data.diagram.caption}
		label={data.diagram.label}
		name={data.diagram.name}
	/>

	<div class="list-meta">
		<span>also at the station</span>
		<span>kind</span>
	</div>
	<ol class="rows">
		{#each data.stations as station, i (station.title)}
			<Row index={i + 1} title={station.title} desc={station.desc} sub={station.stack?.join(' · ')}>
				{#snippet aside()}<span class="kind">{station.kind}</span>{/snippet}
			</Row>
		{/each}
	</ol>
</Pane>

<style>
	.prose {
		max-width: 68ch;
		color: var(--fg-2);
		margin-top: 14px;
	}
	.prose :global(p) {
		margin: 0 0 14px;
	}
	.prose :global(strong) {
		color: var(--fg);
		font-weight: 500;
	}
	.list-meta {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		border-bottom: 1px solid var(--line);
		padding: 20px 8px 8px;
		margin-top: 8px;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.kind {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		color: var(--muted);
		white-space: nowrap;
	}
</style>
