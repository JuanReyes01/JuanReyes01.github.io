import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { matter } from 'vfile-matter';

export interface ParsedMarkdown {
	data: Record<string, unknown>;
	html: string;
}

/**
 * The markdown pipeline for `src/content/**` (design D2): YAML frontmatter
 * + GFM markdown -> HTML. Server-only — see `$lib/server` — so neither
 * `unified` nor the raw markdown ships to the client.
 */
const processor = unified()
	.use(remarkParse)
	.use(remarkFrontmatter, ['yaml'])
	.use(() => (_tree, file) => {
		matter(file);
	})
	.use(remarkGfm)
	.use(remarkRehype)
	.use(rehypeStringify);

export function parseMarkdown(raw: string): ParsedMarkdown {
	const file = processor.processSync(raw);
	const data = (file.data.matter as Record<string, unknown> | undefined) ?? {};
	return { data, html: String(file) };
}
