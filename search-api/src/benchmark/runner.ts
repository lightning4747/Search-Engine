import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

import { parseQuery } from '../query/parser.js';
import { retrievePostings } from '../query/retrieval.js';
import { matchPhrase } from '../query/phraseMatch.js';
import { matchProximity } from '../query/proximityMatch.js';
import { rankDocuments } from '../ranking/ranker.js';
import { getSynonyms } from '../query/synonyms.js';

import { config } from '../config.js';
import { query } from '../db/client.js';
import { esSearch } from '../elasticsearch/search.js';
import { createBenchmarkRun, storeBenchmarkResult, completeBenchmarkRun, failBenchmarkRun } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface QueryItem {
  id: string;
  tier: string;
  text: string;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function runLightningQuery(q: string): Promise<{ resultIds: string[]; totalHits: number }> {
  const plan = parseQuery(q);
  const postings = await retrievePostings(plan);

  const allDocIds = Array.from(new Set(postings.map(p => p.doc_id)));
  const candidateDocIds = new Set<number>();

  for (const docId of allDocIds) {
    const docPostings = postings.filter(p => p.doc_id === docId);
    const docTerms = new Set(docPostings.map(p => p.term.toLowerCase()));

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

  const metaRes = await query('SELECT doc_count, avg_doc_length FROM index_meta WHERE id = 1 LIMIT 1');
  const indexMeta = metaRes.rows.length > 0
    ? { doc_count: Number(metaRes.rows[0].doc_count), avg_doc_length: Number(metaRes.rows[0].avg_doc_length) }
    : { doc_count: 0, avg_doc_length: 0.0 };

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

  const resultIds = ranked.slice(0, 10).map(r => String(r.doc_id));
  return {
    resultIds,
    totalHits: ranked.length
  };
}

export async function runBenchmark(warmupRuns = 3, runsPerQuery = 10): Promise<string> {
  const queriesPath = path.resolve(__dirname, '../../data/benchmark_queries.json');
  const queries: QueryItem[] = JSON.parse(fs.readFileSync(queriesPath, 'utf8'));

  const runId = await createBenchmarkRun(
    queries.length,
    runsPerQuery,
    warmupRuns,
    `Elasticsearch version 8.13.0 comparison run`
  );

  (async () => {
    try {
      const shuffledQueries = shuffle(queries);

      for (let qIdx = 0; qIdx < shuffledQueries.length; qIdx++) {
        const qItem = shuffledQueries[qIdx];
        const engines = qIdx % 2 === 1
          ? ['lightning', 'elasticsearch']
          : ['elasticsearch', 'lightning'];

        for (const engine of engines) {
          // 1. Warmup
          for (let w = 1; w <= warmupRuns; w++) {
            if (engine === 'lightning') {
              await runLightningQuery(qItem.text);
            } else {
              await esSearch(qItem.text, 1, 10);
            }
          }

          // 2. Measure runs
          for (let attempt = 1; attempt <= runsPerQuery; attempt++) {
            const start = performance.now();
            let resultIds: string[] = [];
            let totalHits = 0;

            if (engine === 'lightning') {
              const res = await runLightningQuery(qItem.text);
              resultIds = res.resultIds;
              totalHits = res.totalHits;
            } else {
              const res = await esSearch(qItem.text, 1, 10);
              resultIds = res.results.map(r => r.id);
              totalHits = res.total_hits;
            }
            const duration = performance.now() - start;

            await storeBenchmarkResult(
              runId,
              engine,
              qItem.text,
              qItem.tier,
              attempt,
              duration,
              resultIds,
              totalHits,
              false
            );
          }
        }
      }

      await completeBenchmarkRun(runId);
      console.log(`Benchmark run ${runId} completed successfully.`);
    } catch (err: any) {
      console.error(`Benchmark run ${runId} failed:`, err);
      await failBenchmarkRun(runId, err.message || String(err));
    }
  })();

  return runId;
}
