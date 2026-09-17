import { describe, it, expect } from 'vitest';
import { readoutAt } from './readout';
import { deriveTimeline } from './timeline';
import { parseMonth } from './month';
import { REAL_ENTRIES, TODAY } from './fixtures';

const m = parseMonth;
const timeline = deriveTimeline(REAL_ENTRIES, TODAY);

describe('readoutAt', () => {
	it('picks the Cornell event the month it starts', () => {
		const r = readoutAt(timeline, m('2024-06'));
		expect(r.laneId).toBe('cornell');
		expect(r.text).toBe('Research intern at Cornell — preference alignment, StyleGAN2');
	});

	it('picks the research-assistant event once it starts, even though B.S. and Cornell lanes are still open', () => {
		const r = readoutAt(timeline, m('2024-09'));
		expect(r.laneId).toBe('ra');
		expect(r.text).toBe('Research assistant at Uniandes Economics — argument mining');
	});

	it('picks the ML engineer event once it starts', () => {
		const r = readoutAt(timeline, m('2025-05'));
		expect(r.laneId).toBe('ml');
		expect(r.text).toBe('Joined Creceré as ML engineer — voice agents on ElevenLabs');
	});

	it("picks the B.S. graduation event over the still-open ML lane's earlier event", () => {
		const r = readoutAt(timeline, m('2025-10'));
		expect(r.laneId).toBe('bs');
		expect(r.text).toBe(
			'Graduated from Universidad de los Andes — two B.S. degrees, GPA 4.16 / 5.0'
		);
	});

	it('picks the CAIO promotion exactly on its boundary month', () => {
		const r = readoutAt(timeline, m('2026-02'));
		expect(r.laneId).toBe('caio');
		expect(r.text).toBe('Promoted to Chief AI Officer — CreditBay');
	});

	it('reports every lane active that month as chips, independent of which event is latest', () => {
		const r = readoutAt(timeline, m('2024-07'));
		expect(r.chips.sort()).toEqual(['bs', 'cornell'].sort());
	});

	it('returns a null lane and empty text for a month before any event, with no active chips', () => {
		const r = readoutAt(timeline, m('2019-01'));
		expect(r).toEqual({ date: '2019-01', laneId: null, text: '', chips: [] });
	});
});
