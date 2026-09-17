import { describe, it, expect } from 'vitest';
import {
	experienceFrontmatterSchema,
	workFrontmatterSchema,
	postFrontmatterSchema,
	homeFrontmatterSchema,
	fieldFrontmatterSchema
} from './schemas';

describe('experienceFrontmatterSchema', () => {
	const valid = {
		id: 'caio',
		title: 'Chief AI Officer',
		org: 'Creceré',
		summary: 'Leads AI strategy and engineering.',
		start: '2026-02',
		end: 'present',
		lane: { label: 'Chief AI Officer', short: 'chief ai', color: 'pink' },
		promotedFrom: 'ml',
		events: [{ at: '2026-02', text: 'Promoted to Chief AI Officer' }]
	};

	it('accepts a valid open-ended entry', () => {
		expect(experienceFrontmatterSchema.safeParse(valid).success).toBe(true);
	});

	it('accepts a valid closed-ended entry with no `promotedFrom`', () => {
		const rest: Record<string, unknown> = { ...valid };
		delete rest.promotedFrom;
		expect(experienceFrontmatterSchema.safeParse({ ...rest, end: '2026-01' }).success).toBe(true);
	});

	it('rejects a missing required field', () => {
		const rest: Record<string, unknown> = { ...valid };
		delete rest.org;
		expect(experienceFrontmatterSchema.safeParse(rest).success).toBe(false);
	});

	it('rejects a month that is not YYYY-MM', () => {
		expect(experienceFrontmatterSchema.safeParse({ ...valid, start: '2026-2' }).success).toBe(
			false
		);
	});

	it('rejects an events array with zero entries', () => {
		expect(experienceFrontmatterSchema.safeParse({ ...valid, events: [] }).success).toBe(false);
	});

	it('rejects an unknown top-level key (a typo should fail the build, not be silently dropped)', () => {
		expect(
			experienceFrontmatterSchema.safeParse({ ...valid, sumary: 'typo for summary' }).success
		).toBe(false);
	});

	it('rejects an unknown key inside `lane`', () => {
		expect(
			experienceFrontmatterSchema.safeParse({
				...valid,
				lane: { ...valid.lane, colour: 'pink' }
			}).success
		).toBe(false);
	});

	it('accepts an optional `sub` line (F5 fix — the row sub-line shown under the title)', () => {
		expect(
			experienceFrontmatterSchema.safeParse({
				...valid,
				sub: 'creceré · ai debt-recovery startup · 20 → 600 calls/min'
			}).success
		).toBe(true);
	});

	it('accepts an entry with no `sub` (optional field)', () => {
		expect(experienceFrontmatterSchema.safeParse(valid).success).toBe(true);
	});
});

describe('workFrontmatterSchema', () => {
	const valid = {
		title: 'CreditBay',
		build: 1,
		summary: 'A debt-recovery platform.',
		stack: ['python', 'fastapi'],
		metric: { value: '20 → 600', label: 'calls / min' },
		problem: 'Collectors call thousands of accounts a day.',
		decisions: ['Hexagonal FastAPI monorepo.'],
		results: [{ value: '20 → 600', label: 'calls / min' }]
	};

	it('accepts a valid entry with no diagram', () => {
		expect(workFrontmatterSchema.safeParse(valid).success).toBe(true);
	});

	it('accepts a valid entry with a diagram', () => {
		const withDiagram = {
			...valid,
			diagram: { caption: 'pipeline', label: 'a pipeline diagram', art: 'A -> B' }
		};
		expect(workFrontmatterSchema.safeParse(withDiagram).success).toBe(true);
	});

	it('rejects a non-integer build number', () => {
		expect(workFrontmatterSchema.safeParse({ ...valid, build: 1.5 }).success).toBe(false);
	});

	it('rejects an empty stack array', () => {
		expect(workFrontmatterSchema.safeParse({ ...valid, stack: [] }).success).toBe(false);
	});

	it('rejects an unknown top-level key', () => {
		expect(workFrontmatterSchema.safeParse({ ...valid, buidl: 2 }).success).toBe(false);
	});

	it('rejects an unknown key inside `metric`', () => {
		expect(
			workFrontmatterSchema.safeParse({
				...valid,
				metric: { ...valid.metric, unit: 'calls' }
			}).success
		).toBe(false);
	});

	it('accepts a diagram with an optional `name` prefix (legacy figcaption parity)', () => {
		const withName = {
			...valid,
			diagram: {
				caption: 'pipeline',
				label: 'a pipeline diagram',
				art: 'A -> B',
				name: 'feeder-rfid'
			}
		};
		expect(workFrontmatterSchema.safeParse(withName).success).toBe(true);
	});

	it('rejects an unknown key inside `diagram`', () => {
		expect(
			workFrontmatterSchema.safeParse({
				...valid,
				diagram: { caption: 'pipeline', label: 'a pipeline diagram', art: 'A -> B', title: 'x' }
			}).success
		).toBe(false);
	});
});

describe('postFrontmatterSchema', () => {
	it('accepts a minimal post and defaults draft to true', () => {
		const parsed = postFrontmatterSchema.safeParse({
			title: 'First post',
			date: '2026-09-01',
			summary: 'A first post.'
		});
		expect(parsed.success).toBe(true);
		expect(parsed.success && parsed.data.draft).toBe(true);
	});

	it('rejects a date that is not YYYY-MM-DD', () => {
		expect(
			postFrontmatterSchema.safeParse({
				title: 'x',
				date: '2026/09/01',
				summary: 'x'
			}).success
		).toBe(false);
	});

	it('rejects an unknown top-level key', () => {
		expect(
			postFrontmatterSchema.safeParse({
				title: 'x',
				date: '2026-09-01',
				summary: 'x',
				slug: 'x'
			}).success
		).toBe(false);
	});
});

describe('homeFrontmatterSchema', () => {
	const valid = {
		now: [{ title: 'Ship the site', desc: 'On its way to jreyes.dev.', tags: ['#web'] }],
		how: [{ title: 'Red, green, refactor', desc: 'No merge without tests.', tags: ['#tdd'] }],
		highlights: ['creditbay']
	};

	it('accepts a valid home page frontmatter', () => {
		expect(homeFrontmatterSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects an empty highlights array', () => {
		expect(homeFrontmatterSchema.safeParse({ ...valid, highlights: [] }).success).toBe(false);
	});

	it('rejects an unknown top-level key', () => {
		expect(homeFrontmatterSchema.safeParse({ ...valid, hilights: ['creditbay'] }).success).toBe(
			false
		);
	});

	it('rejects an unknown key inside a `now`/`how` item', () => {
		expect(
			homeFrontmatterSchema.safeParse({
				...valid,
				now: [{ title: 't', desc: 'd', tags: [], icon: 'x' }]
			}).success
		).toBe(false);
	});
});

describe('fieldFrontmatterSchema', () => {
	const valid = {
		diagram: { caption: 'how a visit becomes a result', label: 'pipeline diagram', art: 'A' },
		stations: [{ title: 'Solar autonomy', desc: 'Off-grid power.', kind: 'proposal' }]
	};

	it('accepts a valid field page frontmatter', () => {
		expect(fieldFrontmatterSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects a station with no kind', () => {
		const bad = { ...valid, stations: [{ title: 'x', desc: 'y' }] };
		expect(fieldFrontmatterSchema.safeParse(bad).success).toBe(false);
	});

	it('rejects an unknown top-level key', () => {
		expect(fieldFrontmatterSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
	});

	it('rejects an unknown key inside a station', () => {
		const bad = {
			...valid,
			stations: [{ title: 'x', desc: 'y', kind: 'proposal', status: 'done' }]
		};
		expect(fieldFrontmatterSchema.safeParse(bad).success).toBe(false);
	});

	it("accepts the diagram's optional `name` prefix (legacy figcaption parity: <b>name</b> — caption)", () => {
		const withName = { ...valid, diagram: { ...valid.diagram, name: 'feeder-rfid' } };
		expect(fieldFrontmatterSchema.safeParse(withName).success).toBe(true);
	});
});
