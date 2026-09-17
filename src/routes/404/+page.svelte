<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
</script>

<SeoHead title="404 — Juan Camilo Reyes" description="Page not found." path="/404" noindex={true} />

<section class="not-found" aria-labelledby="not-found-title">
	<h1 id="not-found-title">404</h1>
	<p>That page doesn't exist.</p>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- / always exists -->
	<p><a href="/">← Back home</a></p>
</section>

<style>
	.not-found {
		text-align: center;
		padding: 60px 16px;
	}
	.not-found h1 {
		font-family: var(--font-mono);
		font-size: var(--fs-xl);
		margin: 0 0 10px;
		color: var(--pc, var(--cyan));
	}
	.not-found p {
		color: var(--fg-2);
	}
</style>
