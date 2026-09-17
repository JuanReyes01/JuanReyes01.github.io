<script lang="ts">
	import { page } from '$app/state';
	import '$lib/styles/fonts.css';
	import '$lib/styles/tokens.css';
	import '$lib/styles/base.css';
	import TabBar from '$lib/components/TabBar.svelte';
	import { TABS } from '$lib/site';

	let { children } = $props();
</script>

<a class="skip-link" href="#main">Skip to content</a>

<TabBar tabs={TABS} currentPath={page.url.pathname} />

<div class="app">
	<main id="main" class="stack">
		{@render children()}
	</main>
</div>

<style>
	.app {
		max-width: 76rem;
		margin-inline: auto;
		padding-inline: 16px;
		padding-block: 26px calc(40px + env(safe-area-inset-bottom, 0px));
	}
	.stack {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 26px;
		min-width: 0;
		padding-top: 8px;
	}
</style>
