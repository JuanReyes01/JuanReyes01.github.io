<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import StaticAsciiHeader from '$lib/components/StaticAsciiHeader.svelte';

	// Zero-JS route (design route table) — owner decision site/v2-direction
	// slice S3, item C: still a full-bleed ASCII header, no client JS.
	const FIG = `#   #   ###   #   #
#   #  #   #  #   #
#####  #   #  #####
    #  #   #      #
    #   ###       #`;
</script>

<SeoHead title="404 — Juan Camilo Reyes" description="Page not found." path="/404" noindex={true} />

<section class="not-found" aria-labelledby="not-found-title">
	<StaticAsciiHeader art={FIG} />
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
