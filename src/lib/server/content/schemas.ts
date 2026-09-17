import { z } from 'zod';

/** `YYYY-MM`, validated against the same shape `domain/month.ts` parses. */
export const monthString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'expected YYYY-MM');

export const laneColorSchema = z.enum(['cyan', 'magenta', 'yellow', 'green', 'blue', 'pink']);

const nonEmptyString = z.string().min(1);

export const experienceEventSchema = z.object({
	at: monthString,
	text: nonEmptyString
});

export const experienceFrontmatterSchema = z.object({
	id: nonEmptyString,
	title: nonEmptyString,
	org: nonEmptyString,
	summary: nonEmptyString,
	start: monthString,
	end: z.union([monthString, z.literal('present')]),
	lane: z.object({ label: nonEmptyString, short: nonEmptyString, color: laneColorSchema }),
	promotedFrom: nonEmptyString.optional(),
	events: z.array(experienceEventSchema).min(1)
});
export type ExperienceFrontmatter = z.infer<typeof experienceFrontmatterSchema>;

const metricSchema = z.object({ value: nonEmptyString, label: nonEmptyString });
const diagramSchema = z.object({
	caption: nonEmptyString,
	label: nonEmptyString,
	art: nonEmptyString
});

export const workFrontmatterSchema = z.object({
	title: nonEmptyString,
	build: z.number().int().positive(),
	summary: nonEmptyString,
	stack: z.array(nonEmptyString).min(1),
	metric: metricSchema,
	problem: nonEmptyString,
	decisions: z.array(nonEmptyString).min(1),
	results: z.array(metricSchema).min(1),
	diagram: diagramSchema.optional()
});
export type WorkFrontmatter = z.infer<typeof workFrontmatterSchema>;

export const postFrontmatterSchema = z.object({
	title: nonEmptyString,
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
	summary: nonEmptyString,
	tags: z.array(nonEmptyString).default([]),
	draft: z.boolean().default(true)
});
export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

const indexItemSchema = z.object({
	title: nonEmptyString,
	desc: nonEmptyString,
	tags: z.array(nonEmptyString).default([])
});

export const homeFrontmatterSchema = z.object({
	now: z.array(indexItemSchema).min(1),
	how: z.array(indexItemSchema).min(1),
	highlights: z.array(nonEmptyString).min(1)
});
export type HomeFrontmatter = z.infer<typeof homeFrontmatterSchema>;

export const fieldFrontmatterSchema = z.object({
	diagram: diagramSchema,
	stations: z
		.array(
			z.object({
				title: nonEmptyString,
				desc: nonEmptyString,
				stack: z.array(nonEmptyString).optional(),
				kind: nonEmptyString
			})
		)
		.min(1)
});
export type FieldFrontmatter = z.infer<typeof fieldFrontmatterSchema>;
