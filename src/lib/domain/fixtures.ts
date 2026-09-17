import { parseMonth } from './month';
import type { TimelineInput } from './types';

const m = parseMonth;

/**
 * The real 5-entry career timeline (mirrors `content/experience/*.md` and
 * the legacy `LANES`/`EVENTS`), shared across domain tests so layout, grid
 * and readout assertions all exercise the exact shape the real site
 * renders — labels, ranges and verbatim event text included.
 */
export const REAL_ENTRIES: TimelineInput[] = [
	{
		id: 'bs',
		start: m('2019-08'),
		end: m('2025-10'),
		lane: {
			label: 'B.S. Electronics + B.S. Systems Eng.',
			short: 'b.s. ×2 · uniandes',
			color: 'green'
		},
		events: [
			{
				at: m('2019-08'),
				text: 'Started two B.S. degrees at Universidad de los Andes — electronics and systems engineering'
			},
			{
				at: m('2025-10'),
				text: 'Graduated from Universidad de los Andes — two B.S. degrees, GPA 4.16 / 5.0'
			}
		]
	},
	{
		id: 'cornell',
		start: m('2024-06'),
		end: m('2024-08'),
		lane: { label: 'Research Intern', short: 'research · cornell', color: 'blue' },
		events: [
			{ at: m('2024-06'), text: 'Research intern at Cornell — preference alignment, StyleGAN2' }
		]
	},
	{
		id: 'ra',
		start: m('2024-09'),
		end: m('2025-12'),
		lane: { label: 'Research Assistant', short: 'research · uniandes', color: 'magenta' },
		events: [
			{ at: m('2024-09'), text: 'Research assistant at Uniandes Economics — argument mining' }
		]
	},
	{
		id: 'ml',
		start: m('2025-05'),
		end: m('2026-02'),
		lane: { label: 'Machine Learning Engineer', short: 'ml eng · creceré', color: 'yellow' },
		events: [
			{ at: m('2025-05'), text: 'Joined Creceré as ML engineer — voice agents on ElevenLabs' }
		]
	},
	{
		id: 'caio',
		start: m('2026-02'),
		end: 'present',
		promotedFrom: 'ml',
		lane: { label: 'Chief AI Officer', short: 'chief ai · creceré', color: 'pink' },
		events: [{ at: m('2026-02'), text: 'Promoted to Chief AI Officer — CreditBay' }]
	}
];

/** A "today" later than every content month, matching the batch's own frozen readout. */
export const TODAY = m('2026-09');
