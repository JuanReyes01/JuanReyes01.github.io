/**
 * Bogotá status-bar clock (design D5). Bogotá stays on UTC-5 year round (no
 * DST), so a fixed IANA zone is enough — no offset math needed.
 *
 * This logic is duplicated as a small inline vanilla-JS snippet in
 * `src/app.html` (the status bar must render before any bundled JS loads,
 * per D5's "no visible flash" rendering model, and `app.html` isn't part of
 * Vite's module graph so it cannot `import` this module). Keep both in
 * sync — this file is the tested source of truth for the format.
 */
const formatter = new Intl.DateTimeFormat('en-GB', {
	hour: '2-digit',
	minute: '2-digit',
	timeZone: 'America/Bogota'
});

export function formatBogotaClock(date: Date): string {
	return formatter.format(date);
}
