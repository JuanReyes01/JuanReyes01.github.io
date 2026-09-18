<script lang="ts">
	/**
	 * The full-bleed ASCII header for ZERO-JS pages (owner decision
	 * `site/v2-direction` slice S3, item C): `/work/[slug]/`, `/experience/`
	 * and `/404` must not gain client JS, but still get "in the spirit of"
	 * the same header every hydrated page gets — a wide character field with
	 * the page's figlet title overlaid. The field is computed once, at BUILD
	 * TIME (`staticFieldRows` — pure, deterministic, no canvas), and emitted
	 * as plain text inside a `<pre>`. No pointer ripple here (that needs
	 * JS) — a calm, static frame, exactly like the canvas engines' own
	 * reduced-motion pose.
	 */
	import Figlet from './Figlet.svelte';
	import { staticFieldRows } from '$lib/motion/fields/static-field';
	import { staticWaveformRows } from '$lib/motion/fields/waveform';

	// No JS means no real layout measurement (unlike the canvas headers,
	// which size themselves from the actual rendered box) — these defaults
	// are tuned to fill a realistic desktop header box edge-to-edge at the
	// `.field` font size below (~4.8px/char, ~9.2px/line); narrower
	// viewports simply crop the excess via `overflow: hidden`, same as any
	// other decorative background.
	let {
		art,
		cols = 236,
		rows = 32,
		variant = 'field',
		seed
	}: {
		art: string;
		cols?: number;
		rows?: number;
		/** `wave` gives `/work/[slug]/`'s zero-JS header the same waveform
		    identity the live `/work/` page has (approved header prototype
		    port, requirement 5), instead of the generic ambient cloud field
		    every other static header uses. Requires `seed`. */
		variant?: 'field' | 'wave';
		/** Seed text for `variant="wave"` — same `${slug}:${metric.value}`
		    shape `/work/`'s own build rows pass to `deriveWaveSignature`. */
		seed?: string;
	} = $props();

	const fieldText = $derived(
		variant === 'wave' && seed
			? staticWaveformRows(cols, rows, seed).join('\n')
			: staticFieldRows(cols, rows).join('\n')
	);
</script>

<div class="ascii-header">
	<pre class="field raw-glyphs" aria-hidden="true">{fieldText}</pre>
	<div class="title">
		<div class="title-veil">
			<Figlet {art} />
		</div>
	</div>
</div>

<style>
	.ascii-header {
		position: relative;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--pc, var(--cyan)) 22%, var(--line));
		border-radius: 4px;
		background: var(--banner);
		/* Same target height as `AsciiHeaderFrame` (the hydrated header shell)
		   — a tall, full-bleed protagonist, consistent whether or not the
		   page ships JS. */
		height: clamp(180px, 26vw, 300px);
		display: flex;
		align-items: center;
	}
	.field {
		position: absolute;
		inset: 0;
		margin: 0;
		padding: 10px;
		font-family: var(--font-mono);
		font-size: 0.5rem;
		line-height: 1.15;
		color: var(--pc, var(--cyan));
		white-space: pre;
		opacity: 0.75;
	}
	.title {
		position: relative;
		z-index: 1;
		padding: 14px 18px;
	}
	/* Coordinator correction (site/v2-direction slice S3, apply-fix round
	   1): same veil idiom as AsciiHeaderFrame — the figlet stays crisp text
	   on top of the field, not blended into it. */
	.title-veil {
		padding: 14px 26px;
		border-radius: 8px;
		background: radial-gradient(
			ellipse at center,
			var(--veil) 0%,
			var(--veil) 55%,
			transparent 100%
		);
	}
	/* Same reasoning as AsciiHeaderFrame: a smaller, corner-anchored title
	   leaves most of the field visible instead of the veil covering it. */
	.title-veil :global(.fig) {
		font-size: clamp(0.85rem, 0.5rem + 1.8vw, 1.7rem);
	}
	@media (max-width: 760px) {
		.field {
			font-size: 0.36rem;
		}
	}
	@media (max-width: 480px) {
		.title-veil :global(.fig) {
			font-size: 0.5rem;
		}
		.title-veil {
			padding: 8px 14px;
		}
	}
</style>
