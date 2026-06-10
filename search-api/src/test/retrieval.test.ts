import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { query, pool } from '../db/client.js';
import { retrievePostings } from '../query/retrieval.js';
import { RetrievalPlan } from '../query/parser.js';
import { compressPositions } from '../query/positionCompress.js';


describe('Postings Retrieval Module', () => {
  const minId = 994000;
  const maxId = 995000;

  async function cleanup() {
    await query('DELETE FROM postings WHERE doc_id >= $1 AND doc_id < $2', [minId, maxId]);
    await query('DELETE FROM crawled_pages WHERE id >= $1 AND id < $2', [minId, maxId]);
    await query('DELETE FROM urls WHERE id >= $1 AND id < $2', [minId, maxId]);
    await query("DELETE FROM terms WHERE term IN ('typescript', 'generics', 'exclusion', 'unused')");
  }

  beforeAll(async () => {
    await query('SELECT 1');
    await cleanup();

    // Insert dummy URLs
    await query(`
      INSERT INTO urls (id, url, domain, status)
      VALUES 
      (994001, 'http://test994001.com', 'test994001.com', 'DONE'),
      (994002, 'http://test994002.com', 'test994002.com', 'DONE')
    `);

    // Insert crawled pages
    await query(`
      INSERT INTO crawled_pages (id, url_id, title, description, canonical_url, text_content, doc_length, word_count, is_active, indexed_at)
      VALUES 
      (994001, 994001, 'Doc 1', 'Desc 1', 'http://test994001.com', 'Body 1', 10, 10, true, now()),
      (994002, 994002, 'Doc 2', 'Desc 2', 'http://test994002.com', 'Body 2', 20, 20, true, now())
    `);

    // Insert terms
    await query(`
      INSERT INTO terms (term, doc_frequency)
      VALUES 
      ('typescript', 1),
      ('generics', 2),
      ('exclusion', 1),
      ('unused', 0)
    `);

    // Fetch term IDs
    const termRes = await query("SELECT term_id, term FROM terms WHERE term IN ('typescript', 'generics', 'exclusion')");
    const termMap = new Map<string, number>(termRes.rows.map(r => [r.term, r.term_id]));

    const typescriptId = termMap.get('typescript')!;
    const genericsId = termMap.get('generics')!;
    const exclusionId = termMap.get('exclusion')!;

    // Insert postings
    // Doc 994001: typescript (tf_body = 2), generics (tf_body = 1)
    // Doc 994002: generics (tf_body = 3), exclusion (tf_body = 1)
    await query(
      `INSERT INTO postings (term_id, doc_id, tf_title, tf_heading, tf_body, positions) VALUES ($1, $2, $3, $4, $5, $6)`,
      [typescriptId, 994001, 1, 0, 2, compressPositions([0, 4])]
    );
    await query(
      `INSERT INTO postings (term_id, doc_id, tf_title, tf_heading, tf_body, positions) VALUES ($1, $2, $3, $4, $5, $6)`,
      [genericsId, 994001, 0, 1, 1, compressPositions([2])]
    );
    await query(
      `INSERT INTO postings (term_id, doc_id, tf_title, tf_heading, tf_body, positions) VALUES ($1, $2, $3, $4, $5, $6)`,
      [genericsId, 994002, 1, 0, 3, compressPositions([1, 3, 5])]
    );
    await query(
      `INSERT INTO postings (term_id, doc_id, tf_title, tf_heading, tf_body, positions) VALUES ($1, $2, $3, $4, $5, $6)`,
      [exclusionId, 994002, 0, 0, 1, compressPositions([0])]
    );
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  it('should return empty postings array for empty plan', async () => {
    const plan: RetrievalPlan = {
      must: [],
      exclude: [],
      phrase: [],
      proximity: []
    };
    const postings = await retrievePostings(plan);
    expect(postings).toHaveLength(0);
  });

  it('should fetch postings for must terms', async () => {
    const plan: RetrievalPlan = {
      must: ['typescript'],
      exclude: [],
      phrase: [],
      proximity: []
    };
    const postings = await retrievePostings(plan);
    expect(postings).toHaveLength(1);
    expect(postings[0].doc_id).toBe(994001);
    expect(postings[0].term).toBe('typescript');
    expect(postings[0].tf_body).toBe(2);
    expect(postings[0].positions).toEqual([0, 4]);
  });

  it('should fetch postings for multiple must terms', async () => {
    const plan: RetrievalPlan = {
      must: ['typescript', 'generics'],
      exclude: [],
      phrase: [],
      proximity: []
    };
    const postings = await retrievePostings(plan);
    // Should return postings from both documents
    expect(postings).toHaveLength(3);
    const doc1Postings = postings.filter(p => p.doc_id === 994001);
    const doc2Postings = postings.filter(p => p.doc_id === 994002);
    expect(doc1Postings).toHaveLength(2);
    expect(doc2Postings).toHaveLength(1);
  });

  it('should exclude documents that contain excluded terms', async () => {
    const plan: RetrievalPlan = {
      must: ['generics'],
      exclude: ['exclusion'],
      phrase: [],
      proximity: []
    };
    const postings = await retrievePostings(plan);
    // 'generics' is in both 994001 and 994002.
    // However, 994002 contains 'exclusion', which is excluded.
    // So only 994001 postings should be returned.
    expect(postings).toHaveLength(1);
    expect(postings[0].doc_id).toBe(994001);
    expect(postings[0].term).toBe('generics');
  });

  it('should aggregate positive terms from must, phrase, and proximity clauses', async () => {
    const plan: RetrievalPlan = {
      must: [],
      exclude: [],
      phrase: [{ terms: ['typescript', 'generics'] }],
      proximity: []
    };
    const postings = await retrievePostings(plan);
    // Both 'typescript' and 'generics' should be fetched.
    expect(postings).toHaveLength(3);
  });
});
