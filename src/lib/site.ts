/**
 * Site-wide navigation and section config (design D11/D13, tab labels per
 * owner decision: `1:home 2:experience 3:work 4:field`). `writing` stays out
 * of `TABS` until a first post exists (owner decision).
 */
export type Section = 'about' | 'experience' | 'work' | 'field' | 'writing';

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
	{ href: '/experience/', label: 'experience', number: 2, section: 'experience' },
	{ href: '/work/', label: 'work', number: 3, section: 'work' },
	{ href: '/field/', label: 'field', number: 4, section: 'field' }
];

interface SectionColors {
	pc: string;
	pc2: string;
}

const SECTION_COLORS: Record<Section, SectionColors> = {
	about: { pc: 'cyan', pc2: 'blue' },
	experience: { pc: 'magenta', pc2: 'pink' },
	work: { pc: 'yellow', pc2: 'pink' },
	field: { pc: 'green', pc2: 'cyan' },
	writing: { pc: 'blue', pc2: 'magenta' }
};

/** Derives the current section from a route pathname (design D5: computed at prerender). */
export function sectionForPath(pathname: string): Section {
	if (pathname === '/') return 'about';
	if (pathname.startsWith('/experience')) return 'experience';
	if (pathname.startsWith('/work')) return 'work';
	if (pathname.startsWith('/field')) return 'field';
	if (pathname.startsWith('/writing')) return 'writing';
	return 'about';
}

export function colorsForSection(section: Section): SectionColors {
	return SECTION_COLORS[section];
}
