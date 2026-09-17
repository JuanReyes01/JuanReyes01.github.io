import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {}
	},
	{
		// Purity boundary (design D1): these folders hold DOM-free logic
		// covered by Vitest with `environment: node`. Ban browser globals so
		// the boundary can't erode silently.
		files: ['src/lib/domain/**', 'src/lib/motion/fields/**'],
		languageOptions: {
			globals: {
				window: 'off',
				document: 'off',
				requestAnimationFrame: 'off'
			}
		},
		rules: {
			'no-restricted-globals': [
				'error',
				{
					name: 'window',
					message: 'lib/domain and lib/motion/fields must stay DOM-free (design D1).'
				},
				{
					name: 'document',
					message: 'lib/domain and lib/motion/fields must stay DOM-free (design D1).'
				},
				{
					name: 'requestAnimationFrame',
					message: 'lib/domain and lib/motion/fields must stay DOM-free (design D1).'
				}
			]
		}
	}
);
