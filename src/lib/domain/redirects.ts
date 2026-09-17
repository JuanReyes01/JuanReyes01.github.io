/**
 * Legacy anchor redirects (design D8). The pre-migration site was a single
 * page with in-page anchors; those URLs are still out there (bookmarks,
 * backlinks). Fragments never reach the server, so this map is serialized
 * into an inline `<head>` script on `/` that runs before paint.
 */
export const LEGACY_ANCHORS: Record<string, string> = {
	'#about': '/',
	// Points straight at `/work/`, not `/experience/` — v2 direction slice S1
	// merged the timeline into `/work/`, and routing an old bookmark through
	// the `/experience/` redirect stub would cost it a needless extra hop.
	'#timeline': '/work/',
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

/**
 * Where `/experience/` redirects now that its content merged into `/work/`
 * (owner decision, v2 direction slice S1: "dale, fusionalos en work").
 */
export const EXPERIENCE_REDIRECT_TARGET = '/work/';

/**
 * Builds the inline script for the `/experience/` redirect stub — same
 * pure-string-builder shape as `buildLegacyRedirectScript`, so the
 * `/experience/+page.svelte` route (design D8's string-splitting trick,
 * used there so the literal `<script>` tag text never appears in that file)
 * ships the developer-controlled redirect target, not a hand-duplicated copy.
 */
export function buildExperienceRedirectScript(): string {
	return `location.replace(${JSON.stringify(EXPERIENCE_REDIRECT_TARGET)});`;
}
