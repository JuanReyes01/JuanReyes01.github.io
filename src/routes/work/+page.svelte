<script lang="ts">
	import Pane from '$lib/components/Pane.svelte';
	import Row from '$lib/components/Row.svelte';
	import Metric from '$lib/components/Metric.svelte';
	import Figlet from '$lib/components/Figlet.svelte';
	import Strip from '$lib/components/Strip.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// pyfiglet, font "standard" (apply-fix batch, owner request R2: header
	// text must match the tab name — "WORK", not the old "BUILDS"). Strip is
	// a static SSR-rendered SVG (no canvas, no client JS — this route ships
	// zero JS, `csr = false` in +page.server.ts).
	const FIG = `__        _____  ____  _  __
\\ \\      / / _ \\|  _ \\| |/ /
 \\ \\ /\\ / / | | | |_) | ' /
  \\ V  V /| |_| |  _ <| . \\
   \\_/\\_/  \\___/|_| \\_\\_|\\_\\`;
</script>

<SeoHead
	title="Work — Juan Camilo Reyes"
	description="Case studies from CreditBay and the builds behind it: AI voice agents, a retrieval-augmented knowledge base, and more."
	path="/work/"
/>

<Pane id="work" index={3} title="work" section="work" meta="judged by one number" headingLevel={1}>
	{#snippet head()}
		<Figlet art={FIG} />
		<Strip />
	{/snippet}

	<div class="list-meta">
		<span>{data.builds.length} builds</span>
		<span>metric</span>
	</div>
	<ol class="rows">
		{#each data.builds as build (build.slug)}
			<Row
				index={build.build}
				title={build.title}
				desc={build.summary}
				sub={build.stack.join(' · ')}
				href="/work/{build.slug}/"
			>
				{#snippet aside()}<Metric value={build.metric.value} label={build.metric.label} />{/snippet}
			</Row>
		{/each}
	</ol>
</Pane>

<style>
	.list-meta {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		border-bottom: 1px solid var(--line);
		padding: 0 8px 8px;
		margin-bottom: 4px;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
</style>
