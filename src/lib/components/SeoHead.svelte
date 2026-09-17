<script lang="ts">
	import { SITE_URL } from '$lib/site';

	let {
		title,
		description,
		path,
		noindex = false
	}: {
		title: string;
		description: string;
		/** Route path, e.g. `/` or `/work/creditbay/` — combined with `SITE_URL` for the canonical/OG url. */
		path: string;
		noindex?: boolean;
	} = $props();

	const canonical = $derived(`${SITE_URL}${path}`);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	{#if noindex}
		<meta name="robots" content="noindex" />
	{/if}
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta name="twitter:card" content="summary" />
</svelte:head>
