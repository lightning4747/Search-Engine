import express from 'express';
import { z } from 'zod';
import { spawn } from 'child_process';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import { query } from './db/client.js';
import { parseQuery } from './query/parser.js';
import { retrievePostings } from './query/retrieval.js';
import { matchPhrase } from './query/phraseMatch.js';
import { matchProximity } from './query/proximityMatch.js';
import { rankDocuments } from './ranking/ranker.js';
import { generateSnippet } from './ranking/snippet.js';
import { loadTrie, trie } from './suggest/trieLoader.js';
import { stem } from './query/stemmer.js';
import { suggestCorrection } from './query/spellCheck.js';
import { getSynonyms } from './query/synonyms.js';


const app = express();

// Middleware
app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Basic Request Logger Middleware
app.use((req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    const elapsed = (performance.now() - start).toFixed(2);
    console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${elapsed}ms)`);
  });
  next();
});

// Zod search schema
const searchSchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10)
});

// GET /search Endpoint
app.get('/search', async (req, res) => {
  const start = performance.now();
  const parsed = searchSchema.safeParse(req.query);
  
  if (!parsed.success) {
    return res.status(400).json({ error: 'Missing or empty query parameter "q"' });
  }

  const { q, page, limit } = parsed.data;

  try {
    // 1. Parse query
    const plan = parseQuery(q);

    // 1.5. Run spell check suggestion
    const did_you_mean = suggestCorrection(q);

    // 2. Fetch postings for terms in plan
    const postings = await retrievePostings(plan);

    // 3. Filter candidate doc IDs by AND must-terms, phrase, and proximity constraints
    const allDocIds = Array.from(new Set(postings.map(p => p.doc_id)));
    const candidateDocIds = new Set<number>();

    for (const docId of allDocIds) {
      const docPostings = postings.filter(p => p.doc_id === docId);
      const docTerms = new Set(docPostings.map(p => p.term.toLowerCase()));

      // 3.1 Check must terms (AND retrieval with synonym OR support)
      let matchesMust = true;
      for (const term of plan.must) {
        const synonyms = getSynonyms(term.toLowerCase());
        const termOrSynonymFound = docTerms.has(term.toLowerCase()) || synonyms.some(syn => docTerms.has(syn.toLowerCase()));
        if (!termOrSynonymFound) {
          matchesMust = false;
          break;
        }
      }
      if (!matchesMust) continue;

      // 3.2 Check phrase clauses
      let matchesPhrases = true;
      for (const phraseClause of plan.phrase) {
        const positionLists: number[][] = [];
        for (const term of phraseClause.terms) {
          const post = docPostings.find(p => p.term.toLowerCase() === term.toLowerCase());
          positionLists.push(post ? post.positions : []);
        }
        if (!matchPhrase(positionLists)) {
          matchesPhrases = false;
          break;
        }
      }
      if (!matchesPhrases) continue;

      // 3.3 Check proximity clauses
      let matchesProximity = true;
      for (const proximityClause of plan.proximity) {
        const term1 = proximityClause.terms[0];
        const term2 = proximityClause.terms[1];
        const post1 = docPostings.find(p => p.term.toLowerCase() === term1.toLowerCase());
        const post2 = docPostings.find(p => p.term.toLowerCase() === term2.toLowerCase());
        const pos1 = post1 ? post1.positions : [];
        const pos2 = post2 ? post2.positions : [];
        if (!matchProximity(pos1, pos2, proximityClause.distance)) {
          matchesProximity = false;
          break;
        }
      }
      if (!matchesProximity) continue;

      candidateDocIds.add(docId);
    }

    // 4. Retrieve corpus index metadata
    const metaRes = await query('SELECT doc_count, avg_doc_length FROM index_meta WHERE id = 1 LIMIT 1');
    const indexMeta = metaRes.rows.length > 0 
      ? { doc_count: Number(metaRes.rows[0].doc_count), avg_doc_length: Number(metaRes.rows[0].avg_doc_length) }
      : { doc_count: 0, avg_doc_length: 0.0 };

    // 5. Fetch doc lengths and authority scores for candidate docs
    const docLengths = new Map<number, number>();
    const authorityScores = new Map<number, number>();
    if (candidateDocIds.size > 0) {
      const docRes = await query(
        'SELECT id, doc_length, authority_score FROM crawled_pages WHERE id = ANY($1::int[])',
        [Array.from(candidateDocIds)]
      );
      for (const r of docRes.rows) {
        docLengths.set(Number(r.id), Number(r.doc_length || 0));
        authorityScores.set(Number(r.id), Number(r.authority_score || 0.0));
      }
    }

    // 6. Filter postings to candidate documents and rank them
    const filteredPostings = postings.filter(p => candidateDocIds.has(p.doc_id));

    const hotDocIds = new Set<number>();
    for (const p of filteredPostings) {
      if (p.segment === 'hot') {
        hotDocIds.add(p.doc_id);
      }
    }

    const ranked = rankDocuments(
      plan,
      filteredPostings,
      indexMeta,
      docLengths,
      config.boosts,
      config.bm25.k1,
      config.bm25.b,
      authorityScores,
      config.authority.alpha,
      hotDocIds,
      config.recencyMultiplier,
      config.synonymBoost
    );

    // 7. Paginate
    const totalHits = ranked.length;
    const startIdx = (page - 1) * limit;
    const paginated = ranked.slice(startIdx, startIdx + limit);

    // 8. Fetch page metadata for snippet generation
    let results: any[] = [];
    if (paginated.length > 0) {
      const paginatedDocIds = paginated.map(r => r.doc_id);
      const pagesRes = await query(
        `SELECT cp.id, u.url, cp.title, cp.text_content, u.domain, cp.crawled_at
         FROM crawled_pages cp
         JOIN urls u ON cp.url_id = u.id
         WHERE cp.id = ANY($1::int[])`,
        [paginatedDocIds]
      );
      
      const pagesMap = new Map<number, any>(pagesRes.rows.map(row => [Number(row.id), row]));

      results = paginated.map(rankRes => {
        const pageData = pagesMap.get(rankRes.doc_id);
        const docPostings = filteredPostings.filter(p => p.doc_id === rankRes.doc_id);
        const positionsRecord: Record<string, number[]> = {};
        for (const post of docPostings) {
          positionsRecord[post.term] = post.positions;
        }

        const snippet = generateSnippet({
          bodyText: pageData ? pageData.text_content : '',
          matchedTerms: plan.must,
          positions: positionsRecord
        });

        return {
          id: String(rankRes.doc_id),
          url: pageData ? pageData.url : '',
          title: pageData ? pageData.title : '',
          snippet,
          score: Number(rankRes.score.toFixed(6)),
          domain: pageData ? pageData.domain : '',
          crawled_at: pageData && pageData.crawled_at ? pageData.crawled_at.toISOString() : ''
        };
      });
    }

    const took_ms = Number((performance.now() - start).toFixed(2));
    return res.json({
      query: q,
      total_hits: totalHits,
      page,
      results,
      did_you_mean,
      took_ms
    });

  } catch (err) {
    console.error('Error in /search:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stats Endpoint
app.get('/stats', async (req, res) => {
  try {
    const metaRes = await query('SELECT doc_count, avg_doc_length, last_indexed_at FROM index_meta WHERE id = 1 LIMIT 1');
    const termsRes = await query('SELECT COUNT(*)::int as total_terms FROM terms');

    const meta = metaRes.rows[0] || { doc_count: 0, avg_doc_length: 0.0, last_indexed_at: null };
    const total_terms = termsRes.rows[0]?.total_terms || 0;

    return res.json({
      doc_count: Number(meta.doc_count),
      avg_doc_length: Number(meta.avg_doc_length),
      last_indexed_at: meta.last_indexed_at ? meta.last_indexed_at.toISOString() : null,
      total_terms
    });
  } catch (err) {
    console.error('Error in /stats:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /suggest Endpoint
app.get('/suggest', (req, res) => {
  const start = performance.now();
  const q = req.query.q;
  if (typeof q !== 'string' || !q) {
    return res.json({ suggestions: [] });
  }

  // Normalize and stem prefix
  const clean = q.toLowerCase().replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '');
  if (!clean) {
    return res.json({ suggestions: [] });
  }
  const stemmedPrefix = stem(clean);

  // Search trie
  const matches = trie.search(stemmedPrefix);
  const suggestions = matches.slice(0, 8).map(m => m.term);

  const elapsed = performance.now() - start;
  if (elapsed > 10) {
    console.warn(`[WARNING] /suggest lookup took ${elapsed.toFixed(2)}ms (exceeded 10ms budget)`);
  }

  return res.json({ suggestions });
});

// GET /document/:id Endpoint
app.get('/document/:id', async (req, res) => {
  const idStr = req.params.id;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid document ID format' });
  }

  try {
    const docRes = await query(
      `SELECT cp.id, u.url, cp.title, cp.description, u.domain, cp.crawled_at, cp.indexed_at, cp.word_count, cp.doc_length, cp.is_active
       FROM crawled_pages cp
       JOIN urls u ON cp.url_id = u.id
       WHERE cp.id = $1`,
      [id]
    );

    if (docRes.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = docRes.rows[0];
    if (doc.is_active === false) {
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.json({
      id: String(doc.id),
      url: doc.url,
      title: doc.title,
      description: doc.description,
      domain: doc.domain,
      crawled_at: doc.crawled_at ? doc.crawled_at.toISOString() : null,
      indexed_at: doc.indexed_at ? doc.indexed_at.toISOString() : null,
      word_count: doc.word_count ? Number(doc.word_count) : null,
      doc_length: doc.doc_length ? Number(doc.doc_length) : null
    });

  } catch (err) {
    console.error('Error in /document/:id:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/reindex Endpoint
app.post('/admin/reindex', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== config.xAdminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    const currentFileDir = path.dirname(currentFilePath);
    const indexerDir = path.resolve(currentFileDir, '../../indexer');

    console.log(`Spawning incremental index run in directory: ${indexerDir}`);

    const child = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: indexerDir,
      shell: true,
      detached: true,
      stdio: 'ignore'
    });

    child.unref();

    return res.json({
      status: 'started',
      message: 'Incremental reindexing spawned.'
    });

  } catch (err) {
    console.error('Error in spawning reindex child process:', err);
    return res.status(500).json({ error: 'Failed to start incremental reindexing' });
  }
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

let server: any;
if (process.env.NODE_ENV !== 'test') {
  loadTrie().then(() => {
    server = app.listen(config.port, () => {
      console.log(`Search API server listening on port ${config.port}`);
    });
  }).catch(err => {
    console.error('Fatal error during Search API startup:', err);
    process.exit(1);
  });
}

export { app, server };
