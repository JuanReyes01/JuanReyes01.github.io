import type { Month } from './types';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

/** Parses a `YYYY-MM` string into a `Month` (`year*12 + (month-1)`). */
export function parseMonth(value: string): Month {
	const match = MONTH_RE.exec(value);
	if (!match) throw new Error(`invalid month "${value}", expected YYYY-MM`);
	const year = Number(match[1]);
	const month = Number(match[2]);
	return year * 12 + (month - 1);
}

/** Formats a `Month` back into a zero-padded `YYYY-MM` string. */
export function formatMonth(m: Month): string {
	const year = Math.floor(m / 12);
	const month = (m % 12) + 1;
	return `${year}-${String(month).padStart(2, '0')}`;
}

/** Renders a short human label, e.g. `Feb 2026`. */
export function monthLabel(m: Month): string {
	const year = Math.floor(m / 12);
	const month = m % 12;
	return `${MONTH_NAMES[month]} ${year}`;
}

/** Derives a `Month` from a UTC `Date`, ignoring the day-of-month. */
export function monthFromDate(date: Date): Month {
	return date.getUTCFullYear() * 12 + date.getUTCMonth();
}
