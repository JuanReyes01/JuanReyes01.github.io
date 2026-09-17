# jreyes.dev

Personal site of Juan Camilo Reyes, live at [jreyes.dev](https://jreyes.dev).

A single static page styled like a terminal UI: an ASCII hummingbird in a rippling character sky, an animated git-graph career timeline, and sections for builds and field work.

## Stack (legacy, still live)

- Root `index.html` with inline CSS and vanilla JS: no build step, no dependencies.
- Canvas character grids for the hero and the timeline; 1-bit Bayer dithering for the section strips.
- Fonts: JetBrains Mono and IBM Plex Sans from Google Fonts.
- Respects `prefers-reduced-motion` and `prefers-color-scheme`.

## Run the legacy page locally

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## SvelteKit rewrite (in progress)

The `src/` tree is a SvelteKit 2 + Svelte 5 + TypeScript rewrite, built with [bun](https://bun.sh). It does not affect the live site until the Pages source is switched over.

```sh
bun install       # install dependencies (bun.lock is the single lockfile)
bun run dev       # start the dev server
bun run check     # svelte-check, fails on warnings
bun run lint      # prettier --check + eslint
bun run test      # vitest run
bun run build     # prerender to build/
bun run verify-build  # asserts CNAME/.nojekyll/404.html/feeds and zero-JS routes in build/
```

## Deploy

GitHub Pages currently serves `main` from the repository root (legacy build). `CNAME` pins the custom domain `jreyes.dev`; DNS lives in Cloudflare. Cutover to the SvelteKit build happens once CI is green end-to-end and the Pages source switches to a GitHub Actions workflow.
