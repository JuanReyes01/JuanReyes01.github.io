<script lang="ts">
	let { label, tone }: { label: string; tone?: 'ok' } = $props();
</script>

<span class="tag" class:ok={tone === 'ok'}>{label}</span>

<style>
	.tag {
		font-family: var(--font-mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		margin-right: 8px;
	}
	.tag.ok {
		color: var(--green);
	}
</style>
