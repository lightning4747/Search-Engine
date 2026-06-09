import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { query, pool } from '../db/client.js';
import { initializeMeta, recalculateMeta } from '../meta.js';

describe('Metadata Database Operations', () => {
  beforeAll(async () => {
    // Check connection
    await query('SELECT 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should initialize and recalculate metadata within an isolated transaction', async () => {
    await query('BEGIN');
    try {
      // Clear any leftover test rows first to prevent key conflicts and ensure clean measurements
      await query('DELETE FROM postings WHERE doc_id >= 990000');
      await query('DELETE FROM crawled_pages WHERE id >= 990000');
      await query('DELETE FROM urls WHERE id >= 990000');

      // Get initial state of the database to make the test independent of existing data
      const initialRes = await query(
        'SELECT COUNT(*)::int as count, COALESCE(SUM(doc_length), 0)::float as sum FROM crawled_pages WHERE is_active = true'
      );
      const initialCount = initialRes.rows[0].count;
      const initialSum = initialRes.rows[0].sum;

      // Clear index_meta for the test
      await query('DELETE FROM index_meta');

      // Test initializeMeta
      await initializeMeta();
      const checkRes = await query('SELECT doc_count, avg_doc_length FROM index_meta WHERE id = 1');
      expect(checkRes.rows[0].doc_count).toBe(0);
      expect(checkRes.rows[0].avg_doc_length).toBe(0);

      // Insert dummy URLs first to satisfy FK constraints on crawled_pages.url_id
      await query(`
        INSERT INTO urls (id, url, domain, status)
        VALUES 
        (990001, 'http://test1.com', 'test1.com', 'DONE'),
        (990002, 'http://test2.com', 'test2.com', 'DONE'),
        (990003, 'http://test3.com', 'test3.com', 'DONE')
        ON CONFLICT (id) DO NOTHING
      `);

      // Insert dummy crawled pages
      // One has doc_length = 10, other has doc_length = 20 (both active)
      // Third one is inactive and should not be counted
      await query(`
        INSERT INTO crawled_pages (id, url_id, title, description, canonical_url, text_content, doc_length, word_count, is_active)
        VALUES 
        (990001, 990001, 'Test 1', 'Desc', 'http://test1.com', 'Text', 10, 10, true),
        (990002, 990002, 'Test 2', 'Desc', 'http://test2.com', 'Text', 20, 20, true),
        (990003, 990003, 'Test 3', 'Desc', 'http://test3.com', 'Text', 50, 50, false)
        ON CONFLICT (id) DO NOTHING
      `);

      // Recalculate
      const stats = await recalculateMeta();
      
      const expectedCount = initialCount + 2;
      const expectedAvg = (initialSum + 30) / expectedCount;

      expect(stats.doc_count).toBe(expectedCount);
      expect(stats.avg_doc_length).toBeCloseTo(expectedAvg, 4);

      // Verify it was written to index_meta
      const finalRes = await query('SELECT doc_count, avg_doc_length FROM index_meta WHERE id = 1');
      expect(finalRes.rows[0].doc_count).toBe(expectedCount);
      expect(Number(finalRes.rows[0].avg_doc_length)).toBeCloseTo(expectedAvg, 4);
    } finally {
      // Rollback transaction to keep DB clean
      await query('ROLLBACK');
    }
  });
});
