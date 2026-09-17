/**
 * Post-build output assertions (design "Testing Strategy" / build-deploy
 * spec "Domain files present in build output"). Every check below is a pure
 * function taking already-read file content/paths, so it's unit-testable
 * (`verify-build.test.ts`) without touching the filesystem; only `main()` at
 * the bottom does real I/O, reading the actual `build/` directory produced
 * by `bun run build`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface Issue {
	message: string;
}

const REQUIRED_ROOT_FILES = ['.nojekyll', '404.html', 'rss.xml', 'sitemap.xml'];

/** `build-deploy` spec: "The build output MUST contain CNAME (jreyes.dev) and .nojekyll at its root." */
export function checkCname(content: string | undefined): Issue[] {
	if (content === undefined) return [{ message: 'CNAME is missing from the build output' }];
	const trimmed = content.trim();
	return trimmed === 'jreyes.dev'
		? []
		: [{ message: `CNAME must be exactly "jreyes.dev", got "${trimmed}"` }];
}

export function checkRequiredFiles(exists: (relativePath: string) => boolean): Issue[] {
	return REQUIRED_ROOT_FILES.filter((file) => !exists(file)).map((file) => ({
		message: `missing build/${file}`
	}));
}

/** Extracts every `<loc>` from a sitemap XML document, stripped of the site origin. */
export function sitemapLocPaths(xml: string, siteUrl: string): string[] {
	const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
	return matches.map((loc) => loc.slice(siteUrl.length));
}

/** Every sitemap URL must correspond to a real prerendered HTML file (spec
    "Feed and sitemap coverage" — a sitemap listing dead pages is worse than
    no sitemap). Every route in this site uses trailingSlash: 'always'. */
export function checkSitemapUrlsHaveFiles(
	paths: string[],
	exists: (relativePath: string) => boolean
): Issue[] {
	return paths
		.filter((path) => !exists(`${path}index.html`))
		.map((path) => ({
			message: `sitemap references ${path}, but build/${path}index.html is missing`
		}));
}

/**
 * "Zero client JS" (design testing-strategy row / spec "csr off" routes)
 * means zero *bundled* hydration JS — SvelteKit only emits
 * `<link rel="modulepreload">` for a route's JS entry chunks when it
 * actually hydrates (`csr` !== false). It does NOT mean zero literal
 * `<script>` tags (design D5's ~0.3 KB inline BOG clock script is present
 * on every page, including these zero-hydration ones), and it does NOT
 * mean zero `_app/immutable/` references — component-scoped CSS is served
 * from that same path prefix on every page, hydrated or not.
 */
export function hasClientBundle(html: string): boolean {
	return /rel="modulepreload"/.test(html);
}

/**
 * `/work/` itself now ships the timeline canvas (v2 direction slice S1
 * merged `/experience/` into `/work/`), so it's no longer zero-JS — but
 * every `/work/<slug>/` case study still is. Drops just the work index page
 * from a list of `work/**` html paths, keeping every case study.
 */
export function excludeWorkIndex(paths: string[]): string[] {
	return paths.filter((path) => path !== 'work/index.html');
}

export function checkNoClientBundle(entries: { path: string; html: string }[]): Issue[] {
	return entries
		.filter((entry) => hasClientBundle(entry.html))
		.map((entry) => ({ message: `${entry.path} ships a client JS bundle but must be zero-JS` }));
}

/** Recursively lists every `.html` file under `dir` (relative to `buildDir`), if `dir` exists. */
function listHtmlFiles(buildDir: string, dir: string): string[] {
	const abs = join(buildDir, dir);
	if (!existsSync(abs)) return [];
	const out: string[] = [];
	for (const entry of readdirSync(abs)) {
		const relPath = join(dir, entry);
		const absPath = join(buildDir, relPath);
		if (statSync(absPath).isDirectory()) {
			out.push(...listHtmlFiles(buildDir, relPath));
		} else if (entry.endsWith('.html')) {
			out.push(relPath);
		}
	}
	return out;
}

function main(): void {
	const buildDir = join(import.meta.dirname, '..', 'build');
	const exists = (relativePath: string) => existsSync(join(buildDir, relativePath));
	const readIfExists = (relativePath: string): string | undefined => {
		const abs = join(buildDir, relativePath);
		return existsSync(abs) ? readFileSync(abs, 'utf-8') : undefined;
	};

	const issues: Issue[] = [...checkCname(readIfExists('CNAME')), ...checkRequiredFiles(exists)];

	const sitemapXml = readIfExists('sitemap.xml');
	if (sitemapXml) {
		const paths = sitemapLocPaths(sitemapXml, 'https://jreyes.dev');
		issues.push(...checkSitemapUrlsHaveFiles(paths, exists));
	}

	const zeroJsFiles = [
		...excludeWorkIndex(listHtmlFiles(buildDir, 'work')),
		...listHtmlFiles(buildDir, 'writing'),
		...listHtmlFiles(buildDir, 'experience'),
		'404.html'
	].filter((path) => exists(path));
	const zeroJsEntries = zeroJsFiles.map((path) => ({
		path,
		html: readFileSync(join(buildDir, path), 'utf-8')
	}));
	issues.push(...checkNoClientBundle(zeroJsEntries));

	if (issues.length > 0) {
		console.error(`verify-build: ${issues.length} issue(s) found\n`);
		for (const issue of issues) console.error(`  - ${issue.message}`);
		process.exit(1);
	}

	console.log(`verify-build: OK (${zeroJsFiles.length} zero-JS pages checked)`);
}

// Only run when executed directly (`bun scripts/verify-build.ts`), not when
// imported by verify-build.test.ts.
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
