<script lang="ts">
	import Pane from '$lib/components/Pane.svelte';
	import Row from '$lib/components/Row.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import Metric from '$lib/components/Metric.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { sky } from '$lib/motion/actions/sky';
	import { buildLegacyRedirectScript } from '$lib/domain/redirects';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let heroEl: HTMLDivElement | undefined = $state();

	// Built here (not inline in the markup), with both HTML tag-name literals
	// split mid-word — see Row.svelte's original comment for why this exact
	// text must never appear intact in this file (design D8).
	const scriptOpen = '<scr' + 'ipt>';
	const scriptClose = '<' + '/scr' + 'ipt>';
	const redirectHeadScript = scriptOpen + buildLegacyRedirectScript() + scriptClose;
</script>

<SeoHead
	title="Juan Camilo Reyes — Electronics & Systems Engineer"
	description="Electronics and systems engineer from Bogotá, Colombia. Leads AI and engineering at Creceré, building CreditBay."
	path="/"
/>
<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- developer-controlled, escaped redirect map (design D8), no user input -->
	{@html redirectHeadScript}
</svelte:head>

<Pane id="about" index={1} title="home" section="about" meta="bogotá · utc−5" headingLevel={1}>
	<div class="hero" bind:this={heroEl}>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- not a link -->
		<canvas aria-hidden="true" use:sky={{ host: heroEl }}></canvas>
		<div class="hero-veil" aria-hidden="true"></div>
		<!-- Approved header prototype: "ONE composition, text over field" —
		     the character field fills the whole header and the hero text
		     sits on top of it (no separate figlet card, no text column
		     beside the canvas). -->
		<div class="hero-text">
			<p class="prompt"><b>juan@laptop</b>:~$ whoami</p>
			<h2 id="hello">Hello, I'm Juan<span class="cursor" aria-hidden="true">_</span></h2>
			<div class="bio">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- server-rendered from src/content/pages/home.md via the validated markdown pipeline, not user input -->
				{@html data.bioHtml}
			</div>
			<ul class="links">
				<li>
					<a href="https://github.com/JuanReyes01" rel="me noopener" target="_blank">[ github ↗ ]</a
					>
				</li>
				<li>
					<a
						href="https://www.linkedin.com/in/juan-camilo-reyes-11442b223/"
						rel="me noopener"
						target="_blank">[ linkedin ↗ ]</a
					>
				</li>
			</ul>
		</div>
	</div>

	<div class="index">
		<Pane id="now" title="now" nested headingLevel={2} meta="sep 2026">
			<ul class="idx">
				{#each data.now as item (item.title)}
					<Row title={item.title} desc={item.desc} variant="bullet" scramble={false}>
						{#snippet tags()}
							{#each item.tags as tag (tag)}<Tag label={tag} />{/each}
						{/snippet}
					</Row>
				{/each}
			</ul>
		</Pane>
		<Pane id="how" title="how I work" nested headingLevel={2}>
			<ul class="idx">
				{#each data.how as item (item.title)}
					<Row title={item.title} desc={item.desc} variant="bullet" scramble={false}>
						{#snippet tags()}
							{#each item.tags as tag (tag)}<Tag label={tag} />{/each}
						{/snippet}
					</Row>
				{/each}
			</ul>
		</Pane>
	</div>

	{#if data.highlights.length}
		<div class="highlights">
			<h2>Selected builds</h2>
			<ol class="rows">
				{#each data.highlights as build (build.slug)}
					<Row
						index={build.build}
						title={build.title}
						desc={build.summary}
						href="/work/{build.slug}/"
					>
						{#snippet aside()}<Metric
								value={build.metric.value}
								label={build.metric.label}
							/>{/snippet}
					</Row>
				{/each}
			</ol>
			<p class="more-link">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- /work/ exists as of this PR -->
				<a href="/work/">All builds →</a>
			</p>
		</div>
	{/if}
</Pane>

<style>
	/* Approved header prototype (study 1 — home, "approved as-is"): ONE
	   full-bleed composition — the character field fills the entire header
	   and the hero text sits at the bottom of it over a soft veil, never a
	   text column drawn beside the canvas. */
	.hero {
		position: relative;
		min-height: 560px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		background: var(--banner);
		border: 1px solid color-mix(in srgb, var(--pc, var(--cyan)) 22%, var(--line));
		border-radius: 4px;
		overflow: hidden;
		touch-action: pan-y;
	}
	.hero canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		z-index: 0;
	}
	/* Soft bottom wash + a pool under the text — never a hard left-to-right
	   wipe, or the header reads as "art on one side, words on the other"
	   instead of one composition. Home carries the most copy, so its own
	   wash is deeper than a generic header's (prototype: `.s-home
	   .band::after`). */
	.hero-veil {
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background:
			linear-gradient(to top, var(--veil) 0%, var(--veil) 46%, transparent 76%),
			radial-gradient(
				ellipse 64rem 34rem at 6% 74%,
				var(--veil) 0%,
				var(--veil) 42%,
				transparent 80%
			);
	}
	.hero-text {
		position: relative;
		z-index: 2;
		padding: 0 28px 34px;
	}
	.bio {
		max-width: 56ch;
	}
	.prompt {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		color: var(--muted);
		margin: 0 0 6px;
	}
	.prompt b {
		color: var(--pc, var(--cyan));
		font-weight: 500;
	}
	h2#hello {
		font-family: var(--font-mono);
		font-weight: 500;
		font-size: var(--fs-xl);
		line-height: 1.1;
		letter-spacing: -0.02em;
		margin: 0 0 18px;
	}
	.cursor {
		color: var(--pc, var(--cyan));
		animation: blink 1.1s steps(1) infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cursor {
			animation: none;
		}
	}
	.hero-text :global(p) {
		margin: 0 0 14px;
		color: var(--fg-2);
		font-size: 0.96rem;
	}
	.hero-text :global(p strong) {
		color: var(--fg);
		font-weight: 500;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		list-style: none;
		margin: 4px 0 0;
		padding: 0;
		font-family: var(--font-mono);
		font-size: 0.84rem;
	}
	.links a {
		text-decoration: none;
	}
	.links a:hover {
		text-decoration: underline;
	}

	.index {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 26px 14px;
		margin-top: 30px;
		/* F6 (sveltekit-migration apply-fix batch): without this, both panes
		   stretch to match whichever list is longer, leaving a large empty
		   block under the shorter one. */
		align-items: start;
	}
	.idx {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.highlights {
		margin-top: 30px;
	}
	.highlights h2 {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
		margin: 0 0 6px;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.more-link {
		margin: 10px 2px 0;
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
	}

	@media (max-width: 760px) {
		.hero {
			/* The same rem-sized veil covers proportionally more of a narrow
			   frame on its own (prototype: no separate mobile veil needed) —
			   only the header's own height grows, so both bio paragraphs
			   still have room to read above the fold. */
			min-height: 600px;
		}
		.hero-text {
			padding: 0 18px 24px;
		}
		.bio {
			font-size: 0.92rem;
		}
		.index {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
