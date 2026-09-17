<script lang="ts">
	import { untrack } from 'svelte';
	import Pane from '$lib/components/Pane.svelte';
	import Row from '$lib/components/Row.svelte';
	import Figlet from '$lib/components/Figlet.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { timeline as timelineAction } from '$lib/motion/actions/timeline';
	import type { TimelineActionHandle } from '$lib/motion/actions/timeline';
	import { parseMonth, monthLabel, monthFromDate } from '$lib/domain/month';
	import { deriveTimeline } from '$lib/domain/timeline';
	import { readoutAt, type Readout } from '$lib/domain/readout';
	import { describeTimeline } from '$lib/domain/describe';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Recomputed from `new Date()` on both SSR (build time) and the client
	// (design D4: "SSR uses the build month; the client recomputes from
	// new Date()").
	const timeline = $derived(deriveTimeline(data.timelineInputs, monthFromDate(new Date())));
	const laneColor = $derived(new Map(timeline.lanes.map((lane) => [lane.id, lane.color])));
	const describedText = $derived(describeTimeline(timeline));

	// Seeded once from the initial `timeline` (untracked — this is the
	// starting readout, not a value that should stay bound to `timeline`);
	// every later update comes from the canvas action's onReadout callback.
	let readout: Readout = $state(untrack(() => readoutAt(timeline, timeline.last)));
	const currentMonth = $derived(parseMonth(readout.date));
	const valueText = $derived(`${readout.date}: ${readout.text || 'No event yet'}`);

	let handle: TimelineActionHandle | null = null;

	function onReadout(next: Readout) {
		readout = next;
	}

	function mountTimeline(node: HTMLCanvasElement, params: { onReadout: (r: Readout) => void }) {
		handle = timelineAction(node, { timeline, onReadout: params.onReadout });
		return {
			destroy() {
				handle?.destroy();
				handle = null;
			}
		};
	}

	function dateRange(start: string, end: string): string {
		const startLabel = monthLabel(parseMonth(start));
		const endLabel = end === 'present' ? 'Present' : monthLabel(parseMonth(end));
		return `${startLabel} — ${endLabel}`;
	}

	const FIG = `_____ ___ __  __ _____ _     ___ _   _ _____
|_   _|_ _|  \\/  | ____| |   |_ _| \\ | | ____|
  | |  | || |\\/| |  _| | |    | ||  \\| |  _|
  | |  | || |  | | |___| |___ | || |\\  | |___
  |_| |___|_|  |_|_____|_____|___|_| \\_|_____|`;
</script>

<SeoHead
	title="Experience — Juan Camilo Reyes"
	description="Career timeline: Chief AI Officer at Creceré, plus research roles at Cornell and Universidad de los Andes."
	path="/experience/"
/>

<Pane
	id="experience"
	index={2}
	title="experience"
	section="experience"
	meta="{Math.floor(timeline.epoch / 12)} → {Math.floor(timeline.last / 12)}"
	headingLevel={1}
>
	{#snippet head()}
		<Figlet art={FIG} />
	{/snippet}

	<div class="tl">
		<div class="tl-frame">
			<canvas
				tabindex="0"
				role="slider"
				aria-label="Career timeline"
				aria-valuemin={0}
				aria-valuemax={timeline.last}
				aria-valuenow={currentMonth}
				aria-valuetext={valueText}
				aria-describedby="tl-desc"
				use:mountTimeline={{ onReadout }}
			></canvas>
		</div>
		<p id="tl-desc" class="sr-only">{describedText}</p>
		<div class="tl-readout" aria-hidden="true">
			<span class="tl-date" style="--lc: var(--{laneColor.get(readout.laneId ?? '') ?? 'cyan'})"
				>{readout.date}</span
			>
			<span class="tl-event">{readout.text}</span>
			<span class="tl-chips">
				{#each readout.chips as chipId (chipId)}
					<span class="chip" style="--lc: var(--{laneColor.get(chipId) ?? 'cyan'})"></span>
				{/each}
			</span>
		</div>
		<ul class="tl-legend" aria-hidden="true">
			{#each timeline.lanes as lane (lane.id)}
				<li style="--lc: var(--{lane.color})"><span class="dot">●</span> {lane.label}</li>
			{/each}
		</ul>
	</div>

	<div class="list-meta">
		<span>{data.roles.length} entries · open for details</span>
		<span>when</span>
	</div>
	<ol class="rows">
		{#each data.roles as role, i (role.id)}
			<Row
				index={i + 1}
				title={role.title}
				sub={role.sub}
				lane={role.id}
				onactivate={() => handle?.focusLane(role.id)}
				ondeactivate={() => handle?.focusLane(null)}
			>
				{#snippet aside()}<span class="date">{dateRange(role.start, role.end)}</span>{/snippet}
				{#snippet details()}
					<p class="role-summary">{role.summary}</p>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- server-rendered from src/content/experience/*.md via the validated markdown pipeline, not user input -->
					{@html role.bodyHtml}
				{/snippet}
			</Row>
		{/each}
	</ol>
</Pane>

<style>
	.tl {
		margin-top: 10px;
	}
	.tl-frame {
		overflow-x: auto;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--banner);
		padding: 12px 10px 8px;
	}
	.tl-frame canvas {
		display: block;
		width: 100%;
		height: 220px;
		touch-action: pan-y;
		cursor: ew-resize;
	}
	.tl-frame canvas:focus {
		outline: none;
	}
	.tl-frame canvas:focus-visible {
		outline: 1px dashed var(--pc, var(--cyan));
		outline-offset: 4px;
	}
	.tl-readout {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
		margin-top: 10px;
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		min-height: 3.4em;
	}
	.tl-date {
		color: var(--lc, var(--cyan));
		font-weight: 700;
	}
	.tl-event {
		color: var(--fg-2);
	}
	.tl-chips {
		display: inline-flex;
		gap: 4px;
	}
	.chip {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--lc, var(--cyan));
	}
	.tl-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.tl-legend .dot {
		color: var(--lc, var(--cyan));
	}
	.list-meta {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		border-bottom: 1px solid var(--line);
		padding: 16px 8px 8px;
		margin-top: 20px;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.date {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
		color: var(--muted);
		white-space: nowrap;
	}
	.role-summary {
		margin: 0 0 10px;
	}
</style>
