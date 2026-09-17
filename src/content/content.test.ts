import { describe, it, expect } from 'vitest';
import { experienceEntries, homePage, fieldPage } from '../lib/server/content/collections';

const ALL_CONTENT = import.meta.glob('/src/content/**/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

describe('content integrity (no leaked internal or unapproved copy)', () => {
	it('contains no email address anywhere in src/content', () => {
		for (const [path, raw] of Object.entries(ALL_CONTENT)) {
			expect(raw, `${path} should not contain an email address`).not.toMatch(
				/[\w.+-]+@[\w-]+\.[\w.-]+/
			);
		}
	});

	it('never mentions "homelab" anywhere in src/content', () => {
		for (const [path, raw] of Object.entries(ALL_CONTENT)) {
			expect(raw.toLowerCase(), `${path} should not mention homelab`).not.toContain('homelab');
		}
	});

	it('never mentions a "handoff" anywhere in src/content', () => {
		for (const [path, raw] of Object.entries(ALL_CONTENT)) {
			expect(raw.toLowerCase(), `${path} should not mention a handoff`).not.toContain('handoff');
		}
	});
});

describe('home page hero (owner-approved copy)', () => {
	it('renders both hero paragraphs, including the off-the-clock one', () => {
		const html = homePage().html.replace(/\s+/g, ' ');
		expect(html).toContain('electronics and systems engineer');
		expect(html).toContain(
			"Off the clock it's a 3D printer, a riced Hyprland desktop, and software and hardware for biologists who study hummingbirds."
		);
	});
});

describe('experience events (verbatim legacy copy)', () => {
	it('matches every legacy EVENTS entry verbatim, with B.S. carrying both its start and graduation events', () => {
		const byId = new Map(experienceEntries().map((e) => [e.data.id, e]));

		expect(byId.get('bs')?.data.events.map((e) => e.text)).toEqual([
			'Started two B.S. degrees at Universidad de los Andes — electronics and systems engineering',
			'Graduated from Universidad de los Andes — two B.S. degrees, GPA 4.16 / 5.0'
		]);
		expect(byId.get('cornell')?.data.events.map((e) => e.text)).toEqual([
			'Research intern at Cornell — preference alignment, StyleGAN2'
		]);
		expect(byId.get('ra')?.data.events.map((e) => e.text)).toEqual([
			'Research assistant at Uniandes Economics — argument mining'
		]);
		expect(byId.get('ml')?.data.events.map((e) => e.text)).toEqual([
			'Joined Creceré as ML engineer — voice agents on ElevenLabs'
		]);
		expect(byId.get('caio')?.data.events.map((e) => e.text)).toEqual([
			'Promoted to Chief AI Officer — CreditBay'
		]);
	});

	it('uses the legacy timeline lane labels: org-qualified when wide, bare when narrow', () => {
		const lanes = Object.fromEntries(experienceEntries().map((e) => [e.data.id, e.data.lane]));

		expect(lanes.bs).toMatchObject({ label: 'b.s. ×2 · uniandes', short: 'b.s. ×2' });
		expect(lanes.cornell).toMatchObject({ label: 'research · cornell', short: 'cornell' });
		expect(lanes.ra).toMatchObject({ label: 'research · uniandes', short: 'research' });
		expect(lanes.ml).toMatchObject({ label: 'ml eng · creceré', short: 'ml eng' });
		expect(lanes.caio).toMatchObject({ label: 'chief ai · creceré', short: 'chief ai' });
	});

	it('never mentions a handoff in any experience event', () => {
		for (const entry of experienceEntries()) {
			for (const event of entry.data.events) {
				expect(event.text.toLowerCase()).not.toContain('handoff');
			}
		}
	});
});

describe('field page diagram caption (legacy figcaption parity)', () => {
	it('keeps the "feeder-rfid" name prefix alongside the caption', () => {
		const { diagram } = fieldPage().data;
		expect(diagram.name).toBe('feeder-rfid');
		expect(diagram.caption).toBe('how a visit becomes a result');
	});
});
