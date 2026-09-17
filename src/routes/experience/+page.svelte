<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { EXPERIENCE_REDIRECT_TARGET, buildExperienceRedirectScript } from '$lib/domain/redirects';

	// Built here (not inline in the markup), with the HTML tag-name literal
	// split mid-word — design D8's precedent for the legacy anchor redirect
	// on the home page, kept here for the same reason: the literal
	// `<script>` tag text never appears intact in this source file.
	const scriptOpen = '<scr' + 'ipt>';
	const scriptClose = '<' + '/scr' + 'ipt>';
	const redirectScript = scriptOpen + buildExperienceRedirectScript() + scriptClose;
</script>

<svelte:head>
	<meta http-equiv="refresh" content="0; url={EXPERIENCE_REDIRECT_TARGET}" />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- developer-controlled, escaped redirect target (design D8 pattern), no user input -->
	{@html redirectScript}
</svelte:head>

<SeoHead
	title="Work — Juan Camilo Reyes"
	description="Experience is now part of Work — career timeline and case studies together."
	path={EXPERIENCE_REDIRECT_TARGET}
	noindex={true}
/>

<section class="redirect" aria-labelledby="redirect-title">
	<h1 id="redirect-title">Moved</h1>
	<p>
		Experience is now part of
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- /work/ always exists -->
		<a href={EXPERIENCE_REDIRECT_TARGET}>Work</a>.
	</p>
</section>

<style>
	.redirect {
		text-align: center;
		padding: 60px 16px;
	}
	.redirect h1 {
		font-family: var(--font-mono);
		font-size: var(--fs-xl);
		margin: 0 0 10px;
		color: var(--pc, var(--cyan));
	}
	.redirect p {
		color: var(--fg-2);
	}
</style>
