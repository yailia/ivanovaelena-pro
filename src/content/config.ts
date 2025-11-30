import { defineCollection, z } from 'astro:content';

const blogSchema = z.object({
	title: z.string(),
	date: z.coerce.date(),
	tags: z.array(z.string()).default([]),
	cover: z.string(),
	coverAlt: z.string().optional(),
	excerpt: z.string().optional(),
});

export const blog = defineCollection({
	type: 'content',
	schema: blogSchema,
});

