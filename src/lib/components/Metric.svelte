<script lang="ts">
	let { value, label }: { value: string; label: string } = $props();
</script>

<span class="metric">
	<span class="big">{value}</span>
	<span class="mc">{label}</span>
</span>

<style>
	.metric {
		text-align: right;
	}
	.big {
		display: block;
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: var(--fs-lg);
		color: var(--pc, var(--cyan));
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.mc {
		display: block;
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
	}
</style>
