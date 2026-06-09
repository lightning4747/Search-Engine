import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { query, pool } from '../db/client.js';
import { initializeMeta, recalculateMeta } from '../meta.js';

describe('Metadata Database Operations', () => {
  const minId = 990000;
  const maxId = 991000;

  async function cleanup() {
    await query('DELETE FROM postings WHERE doc_id >= $1 AND doc_id < $2', [minId, maxId]);
    await query('DELETE FROM crawled_pages WHERE id >= $1 AND id < $2', [minId, maxId]);
    await query('DELETE FROM urls WHERE id >= $1 AND id < $2', [minId, maxId]);
    await query('DELETE FROM index_meta');
  }

  beforeAll(async () => {
    await query('SELECT 1');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  it('should initialize and recalculate metadata', async () => {
    // Test initializeMeta
    await initializeMeta();
    const checkRes = await query('SELECT doc_count, avg_doc_length FROM index_meta WHERE id = 1');
    expect(checkRes.rows[0].doc_count).toBe(0);
    expect(checkRes.rows[0].avg_doc_length).toBe(0);

    // Insert dummy URLs first to satisfy FK constraints on crawled_pages.url_id
    await query(`
      INSERT INTO urls (id, url, domain, status)
      VALUES 
      (990001, 'http://test990001.com', 'test990001.com', 'DONE'),
      (990002, 'http://test990002.com', 'test990002.com', 'DONE'),
      (990003, 'http://test990003.com', 'test990003.com', 'DONE')
      ON CONFLICT (id) DO NOTHING
    `);

    // Insert dummy crawled pages
    // One has doc_length = 10, other has doc_length = 20 (both active)
    // Third one is inactive and should not be counted
    await query(`
      INSERT INTO crawled_pages (id, url_id, title, description, canonical_url, text_content, doc_length, word_count, is_active)
      VALUES 
      (990001, 990001, 'Test 1', 'Desc', 'http://test990001.com', 'Text', 10, 10, true),
      (990002, 990002, 'Test 2', 'Desc', 'http://test990002.com', 'Text', 20, 20, true),
      (990003, 990003, 'Test 3', 'Desc', 'http://test990003.com', 'Text', 50, 50, false)
      ON CONFLICT (id) DO NOTHING
    `);

    // Recalculate
    const stats = await recalculateMeta();

    // Query external active pages (excluding our test range [990000, 991000)) to calculate the expected values
    const externalRes = await query(
      'SELECT COUNT(*)::int as count, COALESCE(SUM(doc_length), 0)::float as sum FROM crawled_pages WHERE is_active = true AND (id < 990000 OR id >= 991000)'
    );
    const externalCount = externalRes.rows[0].count;
    const externalSum = externalRes.rows[0].sum;
    
    const expectedCount = externalCount + 2;
    const expectedAvg = (externalSum + 30) / expectedCount;

    expect(stats.doc_count).toBe(expectedCount);
    expect(stats.avg_doc_length).toBeCloseTo(expectedAvg, 4);

    // Verify it was written to index_meta
    const finalRes = await query('SELECT doc_count, avg_doc_length FROM index_meta WHERE id = 1');
    expect(finalRes.rows[0].doc_count).toBe(expectedCount);
    expect(Number(finalRes.rows[0].avg_doc_length)).toBeCloseTo(expectedAvg, 4);
  });
});
