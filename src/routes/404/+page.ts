// adapter-static writes this route's output to `build/404.html` (design D7):
// GitHub Pages (and most static hosts) serve that file for any unmatched
// path. `trailingSlash: 'never'` avoids a spurious redirect for a page that
// isn't linked from anywhere. `paths.relative` (svelte.config, default true
// unless overridden) keeps asset URLs working no matter how deep the
// original unmatched path was.
export const prerender = true;
export const trailingSlash = 'never';
export const csr = false;
