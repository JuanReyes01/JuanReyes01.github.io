<script lang="ts">
	import type { TabConfig } from '$lib/site';
	import { sectionForPath } from '$lib/site';

	let { tabs, currentPath }: { tabs: TabConfig[]; currentPath: string } = $props();

	// Computed at prerender per route (design D5) — no client JS needed to
	// pick the current tab or the status-chip color.
	const currentSection = $derived(sectionForPath(currentPath));
</script>

<header class="tabbar" data-section={currentSection}>
	<div class="tabbar-inner">
		<span class="st-mode" aria-hidden="true">NORMAL</span>
		<nav aria-label="Sections">
			<ul class="tabs raw-glyphs">
				{#each tabs as tab (tab.href)}
					{@const active = tab.href === currentPath}
					<li data-section={tab.section}>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- most tab routes (/experience/, /work/, /field/) don't exist until Phase 5; switch to resolve() once they do -->
						<a href={tab.href} aria-current={active ? 'page' : undefined}>
							<span class="n" aria-hidden="true">{tab.number}:</span>
							<span class="lbl">{tab.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>
		<span class="st-clock" aria-hidden="true"><b>BOG</b><time data-clock>--:--</time></span>
	</div>
</header>

<style>
	.tabbar {
		position: sticky;
		top: env(safe-area-inset-top, 0px);
		z-index: 10;
		background: var(--status-bg);
		border-bottom: 1px solid var(--line);
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
	}
	.tabbar-inner {
		display: flex;
		align-items: stretch;
		gap: 12px;
		max-width: 76rem;
		min-height: 34px;
		margin-inline: auto;
		padding-inline: 16px;
	}
	.st-mode {
		display: flex;
		align-items: center;
		padding-inline: 10px;
		background: var(--pc, var(--cyan));
		color: var(--on-accent);
		font-weight: 700;
		letter-spacing: 0.06em;
	}
	.tabbar nav {
		display: flex;
		min-width: 0;
	}
	.tabs {
		display: flex;
		align-items: stretch;
		gap: 2px;
		min-width: 0;
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tabs li {
		display: flex;
	}
	.tabs a {
		display: flex;
		align-items: center;
		padding-inline: 10px;
		color: var(--fg-2);
		text-decoration: none;
		white-space: nowrap;
	}
	.tabs .n {
		color: var(--pc, var(--cyan));
	}
	.tabs a:hover {
		color: var(--fg);
		background: var(--sel);
	}
	.tabs a[aria-current='page'] {
		color: var(--pc, var(--cyan));
		font-weight: 700;
		background: color-mix(in srgb, var(--pc, var(--cyan)) 16%, transparent);
		box-shadow: inset 0 -2px 0 var(--pc, var(--cyan));
	}
	.st-clock {
		display: flex;
		align-items: center;
		margin-left: auto;
		color: var(--fg);
		white-space: nowrap;
	}
	.st-clock b {
		color: var(--muted);
		font-weight: 400;
		margin-right: 6px;
	}
	@media (max-width: 760px) {
		.tabbar-inner {
			padding-inline: 4px;
			gap: 0;
		}
		.st-mode,
		.st-clock {
			display: none;
		}
		.tabs a {
			padding-inline: 8px;
		}
	}
</style>
