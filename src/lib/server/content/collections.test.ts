import { describe, it, expect } from 'vitest';
import {
	loadExperienceFiles,
	loadWorkFiles,
	loadPostFiles,
	loadHomePageFiles,
	loadFieldPageFiles,
	experienceEntries,
	workEntries,
	postEntries,
	homePage,
	fieldPage,
	sortWorkForDisplay,
	sortExperienceForDisplay
} from './collections';

function md(frontmatter: Record<string, unknown>, body = 'Body.'): string {
	const yaml = Object.entries(frontmatter)
		.map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
		.join('\n');
	return `---\n${yaml}\n---\n\n${body}\n`;
}

const VALID_ML = md({
	id: 'ml',
	title: 'Machine Learning Engineer',
	org: 'Creceré',
	summary: 'Voice agents.',
	start: '2025-05',
	end: '2026-02',
	lane: { label: 'Machine Learning Engineer', short: 'ml eng', color: 'yellow' },
	events: [{ at: '2025-05', text: 'Machine Learning Engineer — Creceré' }]
});
const VALID_CAIO = md({
	id: 'caio',
	title: 'Chief AI Officer',
	org: 'Creceré',
	summary: 'Leads AI strategy.',
	start: '2026-02',
	end: 'present',
	promotedFrom: 'ml',
	lane: { label: 'Chief AI Officer', short: 'chief ai', color: 'pink' },
	events: [{ at: '2026-02', text: 'Promoted to Chief AI Officer — Creceré' }]
});

describe('loadExperienceFiles', () => {
	it('parses and sorts valid experience files by slug', () => {
		const entries = loadExperienceFiles({
			'/src/content/experience/caio.md': VALID_CAIO,
			'/src/content/experience/ml.md': VALID_ML
		});
		expect(entries.map((e) => e.slug)).toEqual(['caio', 'ml']);
		expect(entries[1].data.id).toBe('ml');
	});

	it('throws, naming the file, when frontmatter fails schema validation', () => {
		const invalid = md({ id: 'x' });
		expect(() => loadExperienceFiles({ '/src/content/experience/x.md': invalid })).toThrow(
			/experience\/x\.md/
		);
	});

	it('throws on a duplicate id across two files', () => {
		expect(() =>
			loadExperienceFiles({
				'/src/content/experience/a.md': VALID_ML,
				'/src/content/experience/b.md': VALID_ML
			})
		).toThrow(/duplicate/i);
	});

	it('throws when `promotedFrom` does not match any entry id', () => {
		const orphan = VALID_CAIO.replace('promotedFrom: "ml"', 'promotedFrom: "ghost"');
		expect(() =>
			loadExperienceFiles({
				'/src/content/experience/ml.md': VALID_ML,
				'/src/content/experience/caio.md': orphan
			})
		).toThrow(/promotedFrom/);
	});

	it('throws when the promoted entry does not start where its parent ends', () => {
		const gap = VALID_CAIO.replace('start: "2026-02"', 'start: "2026-03"');
		expect(() =>
			loadExperienceFiles({
				'/src/content/experience/ml.md': VALID_ML,
				'/src/content/experience/caio.md': gap
			})
		).toThrow(/promotedFrom/);
	});

	it('throws when an entry ends before it starts, naming the entry', () => {
		const backwards = VALID_ML.replace('start: "2025-05"', 'start: "2026-05"');
		expect(() => loadExperienceFiles({ '/src/content/experience/ml.md': backwards })).toThrow(
			/ml.*end.*before.*start/is
		);
	});

	it('allows an open-ended ("present") entry regardless of how far in the past it starts', () => {
		const openEnded = VALID_ML.replace('end: "2026-02"', 'end: "present"');
		expect(() => loadExperienceFiles({ '/src/content/experience/ml.md': openEnded })).not.toThrow();
	});
});

describe('loadWorkFiles', () => {
	const base = {
		title: 'CreditBay',
		summary: 'A debt-recovery platform.',
		stack: ['python'],
		metric: { value: '1', label: 'x' },
		problem: 'p',
		decisions: ['d'],
		results: [{ value: '1', label: 'x' }]
	};

	it('throws on a duplicate build number', () => {
		expect(() =>
			loadWorkFiles({
				'/src/content/work/a.md': md({ ...base, build: 1 }),
				'/src/content/work/b.md': md({ ...base, build: 1 })
			})
		).toThrow(/duplicate/i);
	});

	it('accepts distinct build numbers', () => {
		const entries = loadWorkFiles({
			'/src/content/work/a.md': md({ ...base, build: 1 }),
			'/src/content/work/b.md': md({ ...base, build: 2 })
		});
		expect(entries).toHaveLength(2);
	});
});

describe('loadPostFiles', () => {
	it('parses posts and preserves the draft flag', () => {
		const entries = loadPostFiles({
			'/src/content/writing/first.md': md({
				title: 'First',
				date: '2026-01-01',
				summary: 's',
				draft: false
			})
		});
		expect(entries[0].data.draft).toBe(false);
	});
});

describe('loadHomePageFiles / loadFieldPageFiles', () => {
	const homeFile = (highlights: string[]) => ({
		'/src/content/pages/home.md': md({
			now: [{ title: 't', desc: 'd', tags: [] }],
			how: [{ title: 't', desc: 'd', tags: [] }],
			highlights
		})
	});

	it('loads the single home page entry when every highlight matches a known work slug', () => {
		const entry = loadHomePageFiles(homeFile(['creditbay']), ['creditbay', 'amd']);
		expect(entry.data.highlights).toEqual(['creditbay']);
	});

	it('throws when the home page file is missing', () => {
		expect(() => loadHomePageFiles({}, ['creditbay'])).toThrow(/home\.md/);
	});

	it('throws, naming the file, when a highlight references an unknown work slug', () => {
		expect(() => loadHomePageFiles(homeFile(['ghost-project']), ['creditbay', 'amd'])).toThrow(
			/home\.md.*ghost-project/is
		);
	});

	it('loads the single field page entry', () => {
		const entry = loadFieldPageFiles({
			'/src/content/pages/field.md': md({
				diagram: { caption: 'c', label: 'l', art: 'a' },
				stations: [{ title: 't', desc: 'd', kind: 'proposal' }]
			})
		});
		expect(entry.data.stations).toHaveLength(1);
	});
});

describe('sortWorkForDisplay', () => {
	const base = {
		title: 'CreditBay',
		summary: 'A debt-recovery platform.',
		stack: ['python'],
		metric: { value: '1', label: 'x' },
		problem: 'p',
		decisions: ['d'],
		results: [{ value: '1', label: 'x' }]
	};

	it('orders entries by build number ascending, regardless of slug order (legacy row order)', () => {
		const entries = loadWorkFiles({
			'/src/content/work/b.md': md({ ...base, build: 2 }),
			'/src/content/work/a.md': md({ ...base, build: 1 })
		});
		expect(sortWorkForDisplay(entries).map((e) => e.data.build)).toEqual([1, 2]);
	});
});

describe('sortExperienceForDisplay', () => {
	it('orders entries most-recent-start-first (legacy row order)', () => {
		const entries = loadExperienceFiles({
			'/src/content/experience/ml.md': VALID_ML,
			'/src/content/experience/caio.md': VALID_CAIO
		});
		expect(sortExperienceForDisplay(entries).map((e) => e.data.id)).toEqual(['caio', 'ml']);
	});
});

describe('production glob wrappers exercise the real content directory', () => {
	it('all real experience content validates and links promotions', () => {
		const entries = experienceEntries();
		expect(entries.length).toBeGreaterThanOrEqual(5);
		expect(entries.some((e) => e.data.promotedFrom === 'ml')).toBe(true);
	});

	it('all real work content validates with unique build numbers', () => {
		const entries = workEntries();
		const builds = entries.map((e) => e.data.build);
		expect(new Set(builds).size).toBe(builds.length);
		expect(entries.length).toBeGreaterThanOrEqual(5);
	});

	it('all real post content validates (empty collection is fine)', () => {
		expect(() => postEntries()).not.toThrow();
	});

	it('the real home page validates and every highlight resolves to a real work slug', () => {
		const home = homePage();
		expect(home.data.highlights.length).toBeGreaterThan(0);
		const workSlugs = new Set(workEntries().map((e) => e.slug));
		for (const slug of home.data.highlights) expect(workSlugs.has(slug)).toBe(true);
	});

	it('the real field page validates', () => {
		expect(fieldPage().data.stations.length).toBeGreaterThan(0);
	});
});
