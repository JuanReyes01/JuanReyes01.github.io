/**
 * Site-wide navigation and section config (design D11/D13). Tab labels per
 * v2 direction slice S1 (owner: "dale, fusionalos en work" — merge
 * `/experience/` into `/work/`): `1:home 2:work 3:field`. `writing` stays
 * out of `TABS` until a first post exists (owner decision).
 */
export type Section = 'about' | 'work' | 'field' | 'writing';

/** Canonical origin (design D9/build-deploy spec), used by SeoHead and the feeds. */
export const SITE_URL = 'https://jreyes.dev';

export interface TabConfig {
	href: string;
	label: string;
	number: number;
	section: Section;
}

export const TABS: TabConfig[] = [
	{ href: '/', label: 'home', number: 1, section: 'about' },
	{ href: '/work/', label: 'work', number: 2, section: 'work' },
	{ href: '/field/', label: 'field', number: 3, section: 'field' }
];

interface SectionColors {
	pc: string;
	pc2: string;
}

const SECTION_COLORS: Record<Section, SectionColors> = {
	about: { pc: 'cyan', pc2: 'blue' },
	work: { pc: 'yellow', pc2: 'pink' },
	field: { pc: 'green', pc2: 'cyan' },
	writing: { pc: 'blue', pc2: 'magenta' }
};

/** Derives the current section from a route pathname (design D5: computed at
    prerender). `/experience/` is the old route — it now redirects to
    `/work/` (v2 direction slice S1), so it takes on the work section's
    colors for the brief moment before the redirect fires. */
export function sectionForPath(pathname: string): Section {
	if (pathname === '/') return 'about';
	if (pathname.startsWith('/experience')) return 'work';
	if (pathname.startsWith('/work')) return 'work';
	if (pathname.startsWith('/field')) return 'field';
	if (pathname.startsWith('/writing')) return 'writing';
	return 'about';
}

export function colorsForSection(section: Section): SectionColors {
	return SECTION_COLORS[section];
}
