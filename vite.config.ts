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
			prerender: {
				handleHttpError: ({ path, message }) => {
					// TabBar (design-system shell, PR2) links to every section up
					// front; /experience/ and /field/ don't exist as routes yet — they
					// land in the next Phase 5 slice, stacked on top of this one
					// (/work/ and /work/[slug]/ already exist as of this PR).
					// Downgrade only those known, temporary 404s to a warning so the
					// prerender crawler doesn't fail the build; any other broken
					// link still fails it.
					const pendingRoutes = ['/experience/', '/field/'];
					if (pendingRoutes.includes(path)) {
						console.warn(`(pending route, lands in Phase 5) ${message}`);
						return;
					}
					throw new Error(message);
				}
			}
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
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
