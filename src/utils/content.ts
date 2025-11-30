import type { CollectionEntry } from 'astro:content';
import type { BlogPost } from '../types/blog';
import { calculateReadingTime } from './date';

/**
 * Преобразует запись из Content Collection в BlogPost
 */
export function entryToBlogPost(entry: CollectionEntry<'blog'>): BlogPost {
	const body = entry.body ?? '';

	const cleanExcerpt = entry.data.excerpt
		? entry.data.excerpt
		: createExcerptFromBody(body);

	return {
		id: entry.id,
		title: entry.data.title,
		date: entry.data.date,
		tags: entry.data.tags,
		cover: entry.data.cover,
		coverAlt: entry.data.coverAlt,
		excerpt: cleanExcerpt,
		readingTime: calculateReadingTime(body),
	};
}

/**
 * Получает slug из пути файла
 */
export function getSlugFromPath(path: string): string {
	return path.split('/').pop()?.replace(/\.(mdx|md)$/, '') || '';
}

function createExcerptFromBody(body: string, limit = 220): string {
	const cleanText = body.replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim();
	if (!cleanText) return '';
	if (cleanText.length <= limit) {
		return cleanText;
	}
	return `${cleanText.slice(0, limit).trimEnd()}…`;
}

