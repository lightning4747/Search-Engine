import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../index.js';
import { query } from '../db/client.js';

describe('Search API Endpoints', () => {
  let server: any;
  let baseUrl: string;

  const minId = 996000;
  const maxId = 997000;

  async function cleanup() {
    await query('DELETE FROM postings WHERE doc_id >= $1 AND doc_id < $2', [minId, maxId]);
    await query('DELETE FROM crawled_pages WHERE id >= $1 AND id < $2', [minId, maxId]);
    await query('DELETE FROM urls WHERE id >= $1 AND id < $2', [minId, maxId]);
    await query("DELETE FROM terms WHERE term IN ('express', 'search', 'api', 'crawler')");
  }

  beforeAll(async () => {
    // 1. Setup test data
    await query('SELECT 1');
    await cleanup();

    // Insert dummy URLs
    await query(`
      INSERT INTO urls (id, url, domain, status)
      VALUES 
      (996001, 'http://test996001.com', 'test996001.com', 'DONE'),
      (996002, 'http://test996002.com', 'test996002.com', 'DONE')
    `);

    // Insert crawled pages
    await query(`
      INSERT INTO crawled_pages (id, url_id, title, description, canonical_url, text_content, doc_length, word_count, is_active, indexed_at)
      VALUES 
      (996001, 996001, 'Express Search Api Doc', 'Desc 1', 'http://test996001.com', 'The query processor is working!', 10, 10, true, now()),
      (996002, 996002, 'Crawler Api', 'Desc 2', 'http://test996002.com', 'Excluded index results page.', 20, 20, true, now())
    `);

    // Insert index_meta
    await query(`
      INSERT INTO index_meta (id, doc_count, avg_doc_length, last_indexed_at)
      VALUES (1, 2, 15.0, now())
      ON CONFLICT (id) DO UPDATE SET
        doc_count = EXCLUDED.doc_count,
        avg_doc_length = EXCLUDED.avg_doc_length,
        last_indexed_at = EXCLUDED.last_indexed_at
    `);

    // Insert terms
    await query(`
      INSERT INTO terms (term, doc_frequency)
      VALUES 
      ('express', 1),
      ('search', 1),
      ('api', 2),
      ('crawler', 1)
    `);

    // Fetch term IDs
    const termRes = await query("SELECT term_id, term FROM terms WHERE term IN ('express', 'search', 'api', 'crawler')");
    const termMap = new Map<string, number>(termRes.rows.map(r => [r.term, r.term_id]));

    const expressId = termMap.get('express')!;
    const searchId = termMap.get('search')!;
    const apiId = termMap.get('api')!;
    const crawlerId = termMap.get('crawler')!;

    // Insert postings
    await query(`
      INSERT INTO postings (term_id, doc_id, tf_title, tf_heading, tf_body, positions)
      VALUES 
      (${expressId}, 996001, 1, 0, 1, '{0}'),
      (${searchId}, 996001, 1, 0, 1, '{1}'),
      (${apiId}, 996001, 1, 0, 1, '{2}'),
      (${apiId}, 996002, 1, 0, 1, '{1}'),
      (${crawlerId}, 996002, 1, 0, 1, '{0}')
    `);

    // 2. Start HTTP server on a random port
    return new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === 'string' ? address : address?.port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await cleanup();
    return new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  describe('GET /search', () => {
    it('should return 400 on missing query parameter q', async () => {
      const res = await fetch(`${baseUrl}/search`);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('q');
    });

    it('should return 400 on empty query parameter q', async () => {
      const res = await fetch(`${baseUrl}/search?q=`);
      expect(res.status).toBe(400);
    });

    it('should successfully return search results for a matching query', async () => {
      const res = await fetch(`${baseUrl}/search?q=express`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.query).toBe('express');
      expect(json.total_hits).toBe(1);
      expect(json.results).toHaveLength(1);
      expect(json.results[0].id).toBe('996001');
      expect(json.results[0].title).toBe('Express Search Api Doc');
    });
  });

  describe('GET /stats', () => {
    it('should return index statistics', async () => {
      const res = await fetch(`${baseUrl}/stats`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('doc_count');
      expect(json).toHaveProperty('avg_doc_length');
      expect(json).toHaveProperty('total_terms');
    });
  });

  describe('GET /document/:id', () => {
    it('should return 400 on invalid ID format', async () => {
      const res = await fetch(`${baseUrl}/document/abc`);
      expect(res.status).toBe(400);
    });

    it('should return 404 on non-existent document ID', async () => {
      const res = await fetch(`${baseUrl}/document/996999`);
      expect(res.status).toBe(404);
    });

    it('should return document metadata for a valid ID', async () => {
      const res = await fetch(`${baseUrl}/document/996001`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe('996001');
      expect(json.title).toBe('Express Search Api Doc');
      expect(json.url).toBe('http://test996001.com');
    });
  });

  describe('POST /admin/reindex', () => {
    it('should return 401 when X-Admin-Key header is missing', async () => {
      const res = await fetch(`${baseUrl}/admin/reindex`, { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('should return 401 when X-Admin-Key header is invalid', async () => {
      const res = await fetch(`${baseUrl}/admin/reindex`, {
        method: 'POST',
        headers: { 'X-Admin-Key': 'wrong_key' }
      });
      expect(res.status).toBe(401);
    });

    it('should return 200 and start reindexing with valid header', async () => {
      const res = await fetch(`${baseUrl}/admin/reindex`, {
        method: 'POST',
        headers: { 'X-Admin-Key': 'default_admin_key' }
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('started');
    });
  });
});
