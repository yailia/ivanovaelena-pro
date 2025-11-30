export interface BlogPost {
	id: string;
	title: string;
	date: Date;
	tags: string[];
	cover: string;
	coverAlt?: string;
	excerpt: string;
	readingTime: number;
}

export interface BlogPostFrontmatter {
	title: string;
	date: string | Date;
	tags: string[];
	cover: string;
	coverAlt?: string;
	excerpt?: string;
}

