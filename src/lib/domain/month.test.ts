import { describe, it, expect } from 'vitest';
import { parseMonth, formatMonth, monthLabel, monthFromDate } from './month';

describe('parseMonth / formatMonth', () => {
	it('parses "YYYY-MM" and formats back to the same string', () => {
		expect(formatMonth(parseMonth('2019-08'))).toBe('2019-08');
	});

	it('round-trips a different year and month with zero-padding', () => {
		expect(formatMonth(parseMonth('2026-02'))).toBe('2026-02');
	});

	it('orders months numerically so later months compare greater', () => {
		expect(parseMonth('2025-12')).toBeLessThan(parseMonth('2026-02'));
	});

	it('throws on a malformed month string', () => {
		expect(() => parseMonth('2026-2')).toThrow();
	});
});

describe('monthLabel', () => {
	it('renders a short human label for the month', () => {
		expect(monthLabel(parseMonth('2026-02'))).toBe('Feb 2026');
	});

	it('renders a different month/year pair correctly', () => {
		expect(monthLabel(parseMonth('2019-08'))).toBe('Aug 2019');
	});
});

describe('monthFromDate', () => {
	it('derives the Month value from a UTC Date, ignoring the day', () => {
		expect(formatMonth(monthFromDate(new Date(Date.UTC(2026, 8, 17))))).toBe('2026-09');
	});

	it('handles December without rolling into the next year', () => {
		expect(formatMonth(monthFromDate(new Date(Date.UTC(2025, 11, 1))))).toBe('2025-12');
	});
});
