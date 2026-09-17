import { describe, it, expect } from 'vitest';
import { sectionForPath, colorsForSection, TABS } from './site';

describe('sectionForPath', () => {
	it('maps the home route to the about section', () => {
		expect(sectionForPath('/')).toBe('about');
	});

	it('maps the old /experience/ redirect stub to the work section, since that is where it now lands (v2 direction slice S1: merge experience into work)', () => {
		expect(sectionForPath('/experience/')).toBe('work');
	});

	it('maps the work route to the work section', () => {
		expect(sectionForPath('/work/')).toBe('work');
	});

	it('maps a work sub-page (case study) to the work section', () => {
		expect(sectionForPath('/work/creditbay/')).toBe('work');
	});

	it('maps the field route to the field section', () => {
		expect(sectionForPath('/field/')).toBe('field');
	});

	it('maps the hidden writing route to the writing section', () => {
		expect(sectionForPath('/writing/')).toBe('writing');
	});

	it('falls back to about for an unknown path', () => {
		expect(sectionForPath('/does-not-exist/')).toBe('about');
	});
});

describe('colorsForSection', () => {
	it('returns the cyan/blue pair for about', () => {
		expect(colorsForSection('about')).toEqual({ pc: 'cyan', pc2: 'blue' });
	});

	it('returns the yellow/pink pair for work', () => {
		expect(colorsForSection('work')).toEqual({ pc: 'yellow', pc2: 'pink' });
	});
});

describe('TABS', () => {
	it('lists exactly the three visible tabs, in order, with no writing tab (v2 direction slice S1: experience merged into work)', () => {
		expect(TABS.map((tab) => tab.label)).toEqual(['home', 'work', 'field']);
	});

	it('numbers the tabs 1:home 2:work 3:field', () => {
		expect(TABS.map((tab) => tab.number)).toEqual([1, 2, 3]);
	});
});
