import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

const CAIO = {
	id: 'caio',
	start: '2026-02',
	end: 'present' as const,
	lane: { label: 'chief ai · creceré', short: 'chief ai', color: 'pink' as const },
	promotedFrom: 'ml',
	events: [{ at: '2026-02', text: 'Promoted to Chief AI Officer — CreditBay' }]
};

const BS = {
	id: 'bs',
	start: '2019-08',
	end: '2025-10',
	lane: { label: 'b.s. ×2 · uniandes', short: 'b.s. ×2', color: 'green' as const },
	events: [
		{ at: '2019-08', text: 'Started two B.S. degrees' },
		{ at: '2025-10', text: 'Graduated from Universidad de los Andes' }
	]
};

function month(value: string): number {
	const [y, m] = value.split('-').map(Number);
	return y * 12 + (m - 1);
}

function timelineInput(entry: typeof CAIO | typeof BS) {
	return {
		id: entry.id,
		start: month(entry.start),
		end: entry.end === 'present' ? ('present' as const) : month(entry.end),
		lane: entry.lane,
		promotedFrom: 'promotedFrom' in entry ? entry.promotedFrom : undefined,
		events: entry.events.map((e) => ({ at: month(e.at), text: e.text }))
	};
}

const DATA = {
	timelineInputs: [timelineInput(BS), timelineInput(CAIO)],
	roles: [
		{
			id: 'caio',
			title: 'Chief AI Officer',
			org: 'Creceré',
			sub: 'creceré · ai debt-recovery startup · 20 → 600 calls/min',
			summary: 'Leads AI strategy and engineering for CreditBay.',
			start: '2026-02',
			end: 'present',
			bodyHtml: '<ul><li>Led AI strategy.</li></ul>'
		},
		{
			id: 'bs',
			title: 'B.S. Electronics + B.S. Systems Eng.',
			org: 'Universidad de los Andes',
			sub: 'universidad de los andes · graduated oct 2025 · gpa 4.16 / 5.0',
			summary: 'Two degrees at once.',
			start: '2019-08',
			end: '2025-10',
			bodyHtml: '<ul><li>Two degrees.</li></ul>'
		}
	],
	builds: [
		{
			slug: 'creditbay',
			build: 1,
			title: 'CreditBay',
			summary: 'A debt-recovery platform.',
			stack: ['python', 'fastapi'],
			metric: { value: '20 → 600', label: 'calls / min' },
			lane: 'caio'
		},
		{
			slug: 'amd',
			build: 2,
			title: 'Automatic Machine Detection',
			summary: 'Detects voicemail.',
			stack: ['telephony'],
			metric: { value: '~90%', label: 'lower call cost' },
			lane: 'caio'
		}
	]
};

describe('merged work page (/work/) — v2 direction slice S1', () => {
	it('gives the timeline canvas a slider role and valid ARIA range attributes', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toContain('role="slider"');
		expect(body).toContain('aria-valuemin="0"');
		expect(body).toMatch(/aria-valuemax="\d+"/);
		expect(body).toMatch(/aria-describedby="tl-desc"/);
	});

	it('renders a text-equivalent sr-only description of the timeline', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toContain('id="tl-desc"');
		expect(body).toContain('class="sr-only"');
	});

	it('shows the current role dated "Feb 2026 — Present" with no closing date', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toContain('Feb 2026 — Present');
	});

	it('renders each role as a native <details>/<summary> with its highlights inside', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body.match(/<details/g)).toHaveLength(2);
		expect(body).toContain('Led AI strategy.');
	});

	it('renders the role sub-line from content, not just the org name (F5 fix)', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toContain('creceré · ai debt-recovery startup · 20 → 600 calls/min');
	});

	it('lists every build with a link to its case study and its metric', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toMatch(/href="\/work\/creditbay\/"/);
		expect(body).toMatch(/href="\/work\/amd\/"/);
		expect(body).toContain('20 → 600');
		expect(body).toContain('~90%');
	});

	it('never mentions AMD as a company — only as a build', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toContain('Automatic Machine Detection');
	});

	it('has a single h1 for the whole merged page (the pane title) — the timeline, roles and builds all live under one heading', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body.match(/<h1[ >]/g)).toHaveLength(1);
	});

	it('tags each build row with data-lane so hovering/focusing it can highlight its matching career-period lane in the timeline (cross-highlighting)', () => {
		const { body } = render(Page, { props: { data: DATA } });
		expect(body).toMatch(/<a[^>]*data-lane="caio"[^>]*href="\/work\/creditbay\/"/);
		expect(body).toMatch(/<a[^>]*data-lane="caio"[^>]*href="\/work\/amd\/"/);
	});
});
