import { z } from 'zod';
import { parseMarkdown } from './markdown';
import {
	experienceFrontmatterSchema,
	workFrontmatterSchema,
	postFrontmatterSchema,
	homeFrontmatterSchema,
	fieldFrontmatterSchema,
	type ExperienceFrontmatter,
	type FieldFrontmatter,
	type HomeFrontmatter,
	type PostFrontmatter,
	type WorkFrontmatter
} from './schemas';

export interface ContentEntry<T> {
	slug: string;
	data: T;
	html: string;
}

function slugOf(path: string): string {
	return path.split('/').pop()!.replace(/\.md$/, '');
}

/**
 * Parses and validates every raw markdown file in `files` against `schema`.
 * Throws on the first invalid file, naming it (design D3): a silently
 * missing/malformed entry is worse than a red build.
 */
function loadCollection<T>(files: Record<string, string>, schema: z.ZodType<T>): ContentEntry<T>[] {
	return Object.entries(files)
		.map(([path, raw]) => {
			const { data, html } = parseMarkdown(raw);
			const parsed = schema.safeParse(data);
			if (!parsed.success) {
				throw new Error(`${path}: ${z.prettifyError(parsed.error)}`);
			}
			return { slug: slugOf(path), data: parsed.data, html };
		})
		.sort((a, b) => a.slug.localeCompare(b.slug));
}

function assertUnique(values: unknown[], describe: (v: unknown) => string): void {
	const seen = new Set<unknown>();
	for (const v of values) {
		if (seen.has(v)) throw new Error(`duplicate ${describe(v)}`);
		seen.add(v);
	}
}

/** Cross-checks beyond per-file schema validation (design D3). */
function assertExperienceCrossChecks(entries: ContentEntry<ExperienceFrontmatter>[]): void {
	assertUnique(
		entries.map((e) => e.data.id),
		(id) => `experience id: ${id}`
	);

	const byId = new Map(entries.map((e) => [e.data.id, e]));
	for (const entry of entries) {
		const parentId = entry.data.promotedFrom;
		if (!parentId) continue;
		const parent = byId.get(parentId);
		if (!parent) {
			throw new Error(`${entry.slug}: promotedFrom "${parentId}" does not match any experience id`);
		}
		if (parent.data.end !== entry.data.start) {
			throw new Error(
				`${entry.slug}: promotedFrom "${parentId}" ends at ${parent.data.end}, but ${entry.slug} starts at ${entry.data.start} — they must match`
			);
		}
	}
}

function assertWorkCrossChecks(entries: ContentEntry<WorkFrontmatter>[]): void {
	assertUnique(
		entries.map((e) => e.data.build),
		(build) => `work build number: ${build}`
	);
}

/** Pure loader: parses, validates and cross-checks a raw file map. Testable with fixtures. */
export function loadExperienceFiles(
	files: Record<string, string>
): ContentEntry<ExperienceFrontmatter>[] {
	const entries = loadCollection(files, experienceFrontmatterSchema);
	assertExperienceCrossChecks(entries);
	return entries;
}

export function loadWorkFiles(files: Record<string, string>): ContentEntry<WorkFrontmatter>[] {
	const entries = loadCollection(files, workFrontmatterSchema);
	assertWorkCrossChecks(entries);
	return entries;
}

export function loadPostFiles(files: Record<string, string>): ContentEntry<PostFrontmatter>[] {
	return loadCollection(files, postFrontmatterSchema);
}

/** A "page" collection has exactly one file; loading it out of a glob map keeps one code path. */
function loadSingleton<T>(
	files: Record<string, string>,
	schema: z.ZodType<T>,
	expectedPath: string
): ContentEntry<T> {
	const entries = loadCollection(files, schema);
	if (entries.length === 0) {
		throw new Error(`${expectedPath}: required page content is missing`);
	}
	return entries[0];
}

export function loadHomePageFiles(files: Record<string, string>): ContentEntry<HomeFrontmatter> {
	return loadSingleton(files, homeFrontmatterSchema, 'src/content/pages/home.md');
}

export function loadFieldPageFiles(files: Record<string, string>): ContentEntry<FieldFrontmatter> {
	return loadSingleton(files, fieldFrontmatterSchema, 'src/content/pages/field.md');
}

/**
 * Production entry points (design D2): `import.meta.glob` reads the real
 * `src/content/**` tree eagerly, as raw strings, at build/test time. Vite
 * resolves the glob under Vitest too, so "all real content validates" is a
 * real test, not a fixture.
 */
export function experienceEntries(): ContentEntry<ExperienceFrontmatter>[] {
	const files = import.meta.glob('/src/content/experience/*.md', {
		query: '?raw',
		import: 'default',
		eager: true
	}) as Record<string, string>;
	return loadExperienceFiles(files);
}

export function workEntries(): ContentEntry<WorkFrontmatter>[] {
	const files = import.meta.glob('/src/content/work/*.md', {
		query: '?raw',
		import: 'default',
		eager: true
	}) as Record<string, string>;
	return loadWorkFiles(files);
}

export function postEntries(): ContentEntry<PostFrontmatter>[] {
	const files = import.meta.glob('/src/content/writing/*.md', {
		query: '?raw',
		import: 'default',
		eager: true
	}) as Record<string, string>;
	return loadPostFiles(files);
}

export function homePage(): ContentEntry<HomeFrontmatter> {
	const files = import.meta.glob('/src/content/pages/home.md', {
		query: '?raw',
		import: 'default',
		eager: true
	}) as Record<string, string>;
	return loadHomePageFiles(files);
}

export function fieldPage(): ContentEntry<FieldFrontmatter> {
	const files = import.meta.glob('/src/content/pages/field.md', {
		query: '?raw',
		import: 'default',
		eager: true
	}) as Record<string, string>;
	return loadFieldPageFiles(files);
}
