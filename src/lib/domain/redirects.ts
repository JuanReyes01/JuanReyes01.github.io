/**
 * Legacy anchor redirects (design D8). The pre-migration site was a single
 * page with in-page anchors; those URLs are still out there (bookmarks,
 * backlinks). Fragments never reach the server, so this map is serialized
 * into an inline `<head>` script on `/` that runs before paint.
 */
export const LEGACY_ANCHORS: Record<string, string> = {
	'#about': '/',
	'#timeline': '/experience/',
	'#builds': '/work/',
	'#field': '/field/'
};

export function resolveLegacyAnchor(hash: string): string | undefined {
	return LEGACY_ANCHORS[hash];
}

/**
 * Builds the inline script serialized into `/`'s `<svelte:head>`. Kept as a
 * pure string builder so the redirect map itself (not a hand-duplicated
 * copy) is what ships to the browser.
 */
export function buildLegacyRedirectScript(): string {
	const map = JSON.stringify(LEGACY_ANCHORS);
	return `(function(){var m=${map};var t=m[location.hash];if(t)location.replace(t);})();`;
}
