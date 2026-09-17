import { describe, it, expect } from 'vitest';
import { formatBogotaClock } from './clock';

describe('formatBogotaClock', () => {
	it('formats a UTC instant as Bogotá local time (UTC-5)', () => {
		expect(formatBogotaClock(new Date('2026-01-01T17:30:00Z'))).toBe('12:30');
	});

	it('rolls over to the previous day close to UTC midnight', () => {
		expect(formatBogotaClock(new Date('2026-06-15T04:05:00Z'))).toBe('23:05');
	});

	it('pads single-digit hours and minutes with a leading zero', () => {
		expect(formatBogotaClock(new Date('2026-03-10T05:03:00Z'))).toBe('00:03');
	});
});
