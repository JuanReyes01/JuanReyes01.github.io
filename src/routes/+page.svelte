<script lang="ts">
	import Pane from '$lib/components/Pane.svelte';
	import { buildLegacyRedirectScript } from '$lib/domain/redirects';

	// Built here (not inline in the markup), with both HTML tag-name
	// literals split mid-word. HTML tokenizers (browsers, and this file's
	// own Svelte/Prettier parser) end a script element on the literal
	// closing-tag text alone, with no awareness of JS string/comment
	// context — so that exact text must never appear intact in this file,
	// including in a comment.
	const scriptOpen = '<scr' + 'ipt>';
	const scriptClose = '<' + '/scr' + 'ipt>';
	const redirectHeadScript = scriptOpen + buildLegacyRedirectScript() + scriptClose;
</script>

<svelte:head>
	<title>Juan Camilo Reyes</title>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- developer-controlled, escaped redirect map (design D8), no user input -->
	{@html redirectHeadScript}
</svelte:head>

<Pane id="about" index={1} title="home" section="about" meta="bogotá · utc−5">
	<p>
		The full home page — hero, now/how index, and links — lands in a later PR. This placeholder
		proves the design-system shell (tokens, fonts, Pane, TabBar) end to end.
	</p>
</Pane>

<style>
	p {
		color: var(--fg-2);
		max-width: 66ch;
		margin: 0;
	}
</style>
