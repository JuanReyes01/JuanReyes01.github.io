import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			paths: {
				// Absolute asset URLs (design D7): `build/404.html` is served by
				// GitHub Pages for any unmatched path, at any depth, so its asset
				// references can't stay relative to `/404`'s own shallow route depth.
				relative: false
			}
			// Every route from the design's table exists as of this PR — the
			// temporary `handleHttpError` allow-list for /experience/, /work/ and
			// /field/ (Phase 2-4) is gone. Any broken link now fails the build,
			// which is the default `prerender.handleHttpError` behavior.
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
