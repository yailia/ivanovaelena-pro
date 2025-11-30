import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ pattern: '**/index.mdx', base: './src/content/blog' }),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		tags: z.array(z.string()).default([]),
		cover: z.string().optional(),
		coverAlt: z.string().optional(),
		excerpt: z.string().optional(),
	}),
});

export const collections = { blog };

