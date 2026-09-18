<script lang="ts">
	import Pane from '$lib/components/Pane.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import Metric from '$lib/components/Metric.svelte';
	import AsciiDiagram from '$lib/components/AsciiDiagram.svelte';
	import StaticAsciiHeader from '$lib/components/StaticAsciiHeader.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const buildNumber = $derived(String(data.build).padStart(2, '0'));

	// Zero-JS route (design route table) — reuses /work/'s own figlet rather
	// than generating one per build title (owner decision site/v2-direction
	// slice S3, item C: "in the spirit of" the main headers, no client JS).
	const FIG = `__        _____  ____  _  __
\\ \\      / / _ \\|  _ \\| |/ /
 \\ \\ /\\ / / | | | |_) | ' /
  \\ V  V /| |_| |  _ <| . \\
   \\_/\\_/  \\___/|_| \\_\\_|\\_\\`;
</script>

<SeoHead
	title="{data.title} — Work — Juan Camilo Reyes"
	description={data.summary}
	path="/work/{data.slug}/"
/>

<Pane
	id={data.slug}
	index={data.build}
	title={data.title}
	section="work"
	meta="build {buildNumber}"
	headingLevel={1}
>
	{#snippet head()}
		<StaticAsciiHeader art={FIG} />
	{/snippet}

	<p class="summary">{data.summary}</p>
	<ul class="stack" aria-label="Stack">
		{#each data.stack as item (item)}
			<li><Tag label={item} /></li>
		{/each}
	</ul>

	<!-- eslint-disable-next-line svelte/no-at-html-tags -- server-rendered from src/content/work/*.md via the validated markdown pipeline, not user input -->
	<div class="prose">{@html data.bodyHtml}</div>

	<section aria-labelledby="{data.slug}-problem">
		<h2 id="{data.slug}-problem">Problem</h2>
		<p>{data.problem}</p>
	</section>

	<section aria-labelledby="{data.slug}-decisions">
		<h2 id="{data.slug}-decisions">Decisions</h2>
		<ul>
			{#each data.decisions as decision (decision)}
				<li>{decision}</li>
			{/each}
		</ul>
	</section>

	{#if data.diagram}
		<AsciiDiagram
			art={data.diagram.art}
			caption={data.diagram.caption}
			label={data.diagram.label}
			name={data.diagram.name}
		/>
	{/if}

	<section aria-labelledby="{data.slug}-results">
		<h2 id="{data.slug}-results">Results</h2>
		<ul class="results">
			{#each data.results as result (result.label)}
				<li><Metric value={result.value} label={result.label} /></li>
			{/each}
		</ul>
	</section>

	<p class="back-link">
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- /work/ exists as of this PR -->
		<a href="/work/">← All builds</a>
	</p>
</Pane>

<style>
	.summary {
		color: var(--fg-2);
		font-size: var(--fs-md);
		max-width: 64ch;
		margin: 0 0 12px;
	}
	.stack {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 0;
		list-style: none;
		margin: 0 0 18px;
		padding: 0;
	}
	.prose {
		max-width: 64ch;
		color: var(--fg-2);
		margin-bottom: 20px;
	}
	section {
		margin-top: 22px;
	}
	section h2 {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
		margin: 0 0 8px;
	}
	section p,
	section ul {
		margin: 0;
		max-width: 64ch;
		color: var(--fg-2);
	}
	section ul {
		padding-left: 1.2em;
	}
	section li {
		margin: 6px 0;
	}
	/* F7 (sveltekit-migration apply-fix batch): a flex row with `flex-wrap`
	   let a long caption's `<li>` shrink narrower than its own text (the
	   default flex-item `min-width` doesn't protect wrapped text the way it
	   protects `white-space: nowrap` text), so the caption visually ran into
	   the next metric instead of wrapping within its own column. Grid with
	   `max-content` columns gives each metric only the width it needs and
	   never lets one cell's content spill into another. */
	.results {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, max-content));
		column-gap: 40px;
		row-gap: 16px;
		list-style: none;
		padding: 0;
	}
	.results li {
		max-width: 22rem;
	}
	.back-link {
		margin-top: 26px;
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
	}
</style>
