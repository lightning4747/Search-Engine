import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { query, pool } from '../db/client.js';
import { loadUnindexedPages } from '../loader.js';

describe('Document Loader Module', () => {
  beforeAll(async () => {
    // Check connection
    await query('SELECT 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should query unindexed pages with configurable batch sizes', async () => {
    await query('BEGIN');
    try {
      // Clear only our test rows to prevent lock contention on the rest of the database
      await query('DELETE FROM crawled_pages WHERE id >= 999990');
      await query('DELETE FROM urls WHERE id >= 999990');

      // Get initial count of existing unindexed pages in the database
      const countRes = await query(
        'SELECT COUNT(*)::int as count FROM crawled_pages WHERE is_active = true AND indexed_at IS NULL'
      );
      const initialUnindexedCount = countRes.rows[0].count;

      // Insert dummy URLs first to satisfy FK constraints on crawled_pages.url_id
      await query(`
        INSERT INTO urls (id, url, domain, status)
        VALUES 
        (999991, 'http://test1.com', 'test1.com', 'DONE'),
        (999992, 'http://test2.com', 'test2.com', 'DONE'),
        (999993, 'http://test3.com', 'test3.com', 'DONE'),
        (999994, 'http://test4.com', 'test4.com', 'DONE')
      `);

      // Insert crawled pages:
      // Page 1: Active, Unindexed (indexed_at IS NULL)
      // Page 2: Active, Unindexed (indexed_at IS NULL)
      // Page 3: Active, Indexed (indexed_at NOT NULL)
      // Page 4: Inactive, Unindexed (is_active = false)
      await query(`
        INSERT INTO crawled_pages (id, url_id, title, description, canonical_url, text_content, doc_length, word_count, is_active, indexed_at, headings)
        VALUES 
        (999991, 999991, 'Test 1', 'Desc 1', 'http://test1.com', 'Body 1', 10, 10, true, null, '{"h1": ["Heading 1"]}'::jsonb),
        (999992, 999992, 'Test 2', 'Desc 2', 'http://test2.com', 'Body 2', 20, 20, true, null, '{"h1": ["Heading 2"]}'::jsonb),
        (999993, 999993, 'Test 3', 'Desc 3', 'http://test3.com', 'Body 3', 30, 30, true, NOW(), '{"h1": ["Heading 3"]}'::jsonb),
        (999994, 999994, 'Test 4', 'Desc 4', 'http://test4.com', 'Body 4', 40, 40, false, null, '{"h1": ["Heading 4"]}'::jsonb)
      `);

      // Request a batch size large enough to include all pre-existing unindexed pages + our 2 new ones
      const targetBatchSize = initialUnindexedCount + 5;
      const allPages = await loadUnindexedPages(targetBatchSize);
      
      const testPages = allPages.filter(p => p.id >= 999990);
      expect(testPages.length).toBe(2);
      expect(testPages.map(p => p.id)).toEqual([999991, 999992]);
      expect(testPages[0].title).toBe('Test 1');
      expect(testPages[0].headings).toEqual({ h1: ['Heading 1'] });

      // Test loading with batch size 1 (should return exactly 1 page from the DB)
      const batchOne = await loadUnindexedPages(1);
      expect(batchOne.length).toBe(1);
    } finally {
      // Rollback transaction to keep DB clean
      await query('ROLLBACK');
    }
  });
});
