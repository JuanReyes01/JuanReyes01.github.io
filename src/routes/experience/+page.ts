// The old `/experience/` route now redirects to `/work/` (owner decision,
// v2 direction slice S1: "dale, fusionalos en work" — experience merged
// into work). No data to load and no hydration needed: the redirect below
// is a plain inline `<script>` (design D8's string-splitting trick), which
// runs regardless of `csr`.
export const csr = false;
