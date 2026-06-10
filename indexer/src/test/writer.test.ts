import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { query, pool } from '../db/client.js';
import { writeIndexBatch } from '../writer.js';
import { DocumentIndex } from '../indexDocument.js';
import { decompressPositions } from '../compression/positionCompress.js';


describe('Batch Postings Writer Module', () => {
  const minId = 992000;
  const maxId = 993000;

  async function cleanup() {
    await query('DELETE FROM postings WHERE doc_id >= $1 AND doc_id < $2', [minId, maxId]);
    await query('DELETE FROM crawled_pages WHERE id >= $1 AND id < $2', [minId, maxId]);
    await query('DELETE FROM urls WHERE id >= $1 AND id < $2', [minId, maxId]);
    await query("DELETE FROM terms WHERE term IN ('shared', 'unique1')");
  }

  beforeAll(async () => {
    await query('SELECT 1');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  it('should atomically write terms, postings, and update indexed_at', async () => {
    // Insert dummy URLs first to satisfy FK constraints
    await query(`
      INSERT INTO urls (id, url, domain, status)
      VALUES 
      (992001, 'http://test992001.com', 'test992001.com', 'DONE'),
      (992002, 'http://test992002.com', 'test992002.com', 'DONE')
    `);

    // Insert crawled pages
    await query(`
      INSERT INTO crawled_pages (id, url_id, title, description, canonical_url, text_content, doc_length, word_count, is_active, indexed_at)
      VALUES 
      (992001, 992001, 'Test 1', 'Desc 1', 'http://test992001.com', 'Body 1', 10, 10, true, null),
      (992002, 992002, 'Test 2', 'Desc 2', 'http://test992002.com', 'Body 2', 20, 20, true, null)
    `);

    // Build DocumentIndex batch
    const batch: DocumentIndex[] = [
      {
        docId: 992001,
        terms: new Map([
          ['shared', { tf_title: 1, tf_heading: 0, tf_body: 1, positions: [0] }],
          ['unique1', { tf_title: 0, tf_heading: 1, tf_body: 0, positions: [] }]
        ]),
        fingerprint: null
      },
      {
        docId: 992002,
        terms: new Map([
          ['shared', { tf_title: 0, tf_heading: 0, tf_body: 2, positions: [1, 5] }]
        ]),
        fingerprint: null
      }
    ];

    // Write batch
    await writeIndexBatch(batch);

    // Verify terms table has been populated and doc_frequency is correct
    const sharedTermRes = await query("SELECT term_id, doc_frequency FROM terms WHERE term = 'shared'");
    expect(sharedTermRes.rowCount).toBe(1);
    expect(sharedTermRes.rows[0].doc_frequency).toBe(2); // In both 992001 and 992002

    const uniqueTermRes = await query("SELECT term_id, doc_frequency FROM terms WHERE term = 'unique1'");
    expect(uniqueTermRes.rowCount).toBe(1);
    expect(uniqueTermRes.rows[0].doc_frequency).toBe(1); // Only in 992001

    const sharedTermId = sharedTermRes.rows[0].term_id;
    const uniqueTermId = uniqueTermRes.rows[0].term_id;

    // Verify postings are inserted
    const postingsRes = await query(
      'SELECT term_id, doc_id, tf_title, tf_heading, tf_body, positions FROM postings WHERE doc_id >= 992000 ORDER BY doc_id, term_id'
    );
    expect(postingsRes.rowCount).toBe(3);
    
    const p1 = postingsRes.rows.find(p => p.doc_id === 992001 && p.term_id === sharedTermId);
    expect(p1).toBeDefined();
    expect(p1.tf_title).toBe(1);
    expect(p1.tf_body).toBe(1);
    expect(decompressPositions(p1.positions)).toEqual([0]);

    const p2 = postingsRes.rows.find(p => p.doc_id === 992001 && p.term_id === uniqueTermId);
    expect(p2).toBeDefined();
    expect(p2.tf_heading).toBe(1);

    const p3 = postingsRes.rows.find(p => p.doc_id === 992002 && p.term_id === sharedTermId);
    expect(p3).toBeDefined();
    expect(p3.tf_body).toBe(2);
    expect(decompressPositions(p3.positions)).toEqual([1, 5]);

    // Verify indexed_at is not null
    const pagesRes = await query('SELECT id, indexed_at FROM crawled_pages WHERE id >= 992000');
    expect(pagesRes.rows[0].indexed_at).not.toBeNull();
    expect(pagesRes.rows[1].indexed_at).not.toBeNull();

    // Test re-indexing safety (overwriting)
    const updatedBatch: DocumentIndex[] = [
      {
        docId: 992001,
        terms: new Map([
          ['shared', { tf_title: 0, tf_heading: 0, tf_body: 3, positions: [2, 3, 4] }] // tf changed, positions changed, unique1 removed
        ]),
        fingerprint: null
      }
    ];

    await writeIndexBatch(updatedBatch);

    // Verify posting for unique1 is deleted for doc 992001
    const checkUniqueRes = await query(
      'SELECT 1 FROM postings WHERE doc_id = 992001 AND term_id = $1',
      [uniqueTermId]
    );
    expect(checkUniqueRes.rowCount).toBe(0);

    // Verify term doc_frequency is recalculated for unique1 (now should be 0 because 992001 no longer has it)
    const checkUniqueTermRes = await query("SELECT doc_frequency FROM terms WHERE term = 'unique1'");
    expect(checkUniqueTermRes.rows[0].doc_frequency).toBe(0);

    // Verify posting for shared is updated
    const checkSharedRes = await query(
      'SELECT tf_body, positions FROM postings WHERE doc_id = 992001 AND term_id = $1',
      [sharedTermId]
    );
    expect(checkSharedRes.rows[0].tf_body).toBe(3);
    expect(decompressPositions(checkSharedRes.rows[0].positions)).toEqual([2, 3, 4]);
  });
});
