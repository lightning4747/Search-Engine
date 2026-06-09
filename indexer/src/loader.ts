import { query } from './db/client.js';

export interface Headings {
  h1: string[];
  h2: string[];
  h3: string[];
}

export interface CrawledPage {
  id: number;
  url_id: number;
  title: string | null;
  description: string | null;
  canonical_url: string | null;
  headings: Headings | null;
  text_content: string | null;
  crawled_at: Date;
  doc_length: number;
  word_count: number;
  is_active: boolean;
  indexed_at: Date | null;
}

/**
 * Queries the database for active crawled pages that have not yet been indexed
 * (i.e. where is_active = true and indexed_at is null), ordered by ID.
 * Supports a configurable batch size.
 * 
 * @param batchSize Number of documents to fetch (default 500)
 * @returns A promise resolving to an array of CrawledPage objects
 */
export async function loadUnindexedPages(batchSize: number = 500): Promise<CrawledPage[]> {
  const result = await query(
    `SELECT id, url_id, title, description, canonical_url, headings, text_content, 
            crawled_at, doc_length, word_count, is_active, indexed_at
     FROM crawled_pages
     WHERE is_active = true AND indexed_at IS NULL
     ORDER BY id ASC
     LIMIT $1`,
    [batchSize]
  );

  return result.rows.map(row => ({
    id: row.id,
    url_id: row.url_id,
    title: row.title,
    description: row.description,
    canonical_url: row.canonical_url,
    headings: typeof row.headings === 'string' ? JSON.parse(row.headings) : row.headings,
    text_content: row.text_content,
    crawled_at: new Date(row.crawled_at),
    doc_length: Number(row.doc_length),
    word_count: Number(row.word_count),
    is_active: row.is_active,
    indexed_at: row.indexed_at ? new Date(row.indexed_at) : null,
  }));
}
