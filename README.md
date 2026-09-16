# jreyes.dev

Personal site of Juan Camilo Reyes, live at [jreyes.dev](https://jreyes.dev).

A single static page styled like a terminal UI: an ASCII hummingbird in a rippling character sky, an animated git-graph career timeline, and sections for builds and field work.

## Stack

- One `index.html` with inline CSS and vanilla JS: no build step, no dependencies.
- Canvas character grids for the hero and the timeline; 1-bit Bayer dithering for the section strips.
- Fonts: JetBrains Mono and IBM Plex Sans from Google Fonts.
- Respects `prefers-reduced-motion` and `prefers-color-scheme`.

## Run locally

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Deploy

GitHub Pages serves `main` from the repository root. `CNAME` pins the custom domain `jreyes.dev`; DNS lives in Cloudflare.
