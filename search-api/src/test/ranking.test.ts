import { describe, it, expect } from 'vitest';
import { scoreBM25 } from '../ranking/bm25.js';
import { scoreFieldWeighted, DEFAULT_FIELD_BOOSTS } from '../ranking/fieldBoost.js';
import { rankDocuments, PostingRow, IndexMeta, RetrievalPlan } from '../ranking/ranker.js';

describe('BM25 Scorer Module', () => {
  it('should return 0 when tf is 0', () => {
    expect(scoreBM25(0, 10, 100, 50, 45)).toBe(0);
    expect(scoreBM25(-1, 10, 100, 50, 45)).toBe(0);
  });

  it('should verify IDF is never negative', () => {
    // If df = N (e.g. term appears in all documents), verify IDF doesn't go negative
    const scoreFull = scoreBM25(5, 100, 100, 50, 45);
    expect(scoreFull).toBeGreaterThanOrEqual(0);
    
    // Test with df > N (simulated edge case)
    const scoreExcess = scoreBM25(5, 120, 100, 50, 45);
    expect(scoreExcess).toBe(0); // IDF should be floored at 0
  });

  it('should verify score increases with higher TF', () => {
    const scoreLow = scoreBM25(1, 10, 100, 50, 45);
    const scoreHigh = scoreBM25(5, 10, 100, 50, 45);
    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it('should compute correct scores for known input/output pairs', () => {
    // k1 = 1.5, b = 0.75
    // tf = 2, df = 10, N = 100, avgdl = 50, docLen = 50
    // idf = log((100 - 10 + 0.5)/(10 + 0.5) + 1) = log(90.5/10.5 + 1) = log(8.6190476 + 1) = log(9.6190476) = 2.263745
    // docLen / avgdl = 50 / 50 = 1
    // tfComponent = (2 * 2.5) / (2 + 1.5 * (1 - 0.75 + 0.75 * 1)) = 5 / (2 + 1.5 * 1) = 5 / 3.5 = 1.428571
    // expectedScore = 2.263745 * 1.428571 = 3.233922
    const score = scoreBM25(2, 10, 100, 50, 50);
    expect(score).toBeCloseTo(3.233922, 5);
  });
});

describe('Field-Weighted Scoring Module', () => {
  it('should confirm a title match outscores a body-only match for equivalent TF', () => {
    // N = 100, df = 10, avgdl = 50, docLen = 50, tf = 2
    // Title match: tf_title = 2, tf_heading = 0, tf_body = 0
    const titleScore = scoreFieldWeighted(2, 0, 0, 10, 100, 50, 50);
    
    // Body-only match: tf_title = 0, tf_heading = 0, tf_body = 2
    const bodyScore = scoreFieldWeighted(0, 0, 2, 10, 100, 50, 50);

    expect(titleScore).toBeGreaterThan(bodyScore);
    // Since title boost is 3.0 and body boost is 1.0, title score should be exactly 3.0 times body score
    expect(titleScore).toBeCloseTo(bodyScore * 3.0, 5);
  });
});

describe('Document Ranker Module', () => {
  const indexMeta: IndexMeta = {
    doc_count: 100,
    avg_doc_length: 50,
  };

  const docLengths = new Map<number, number>([
    [1, 40],
    [2, 60],
    [3, 50],
    [4, 80],
  ]);

  it('should rank candidate documents, apply exclusions, and sort correctly', () => {
    const plan: RetrievalPlan = {
      must: ['term1', 'term2'],
      exclude: ['spam'],
    };

    const postings: PostingRow[] = [
      // Doc 1 matches term1 and term2
      { term: 'term1', doc_id: 1, tf_title: 1, tf_heading: 0, tf_body: 2, positions: [5, 12], df: 10 },
      { term: 'term2', doc_id: 1, tf_title: 0, tf_heading: 1, tf_body: 1, positions: [18], df: 20 },

      // Doc 2 matches term1
      { term: 'term1', doc_id: 2, tf_title: 0, tf_heading: 0, tf_body: 1, positions: [8], df: 10 },

      // Doc 3 matches term1 and term2 but contains the excluded term 'spam'
      { term: 'term1', doc_id: 3, tf_title: 1, tf_heading: 1, tf_body: 5, positions: [1, 2, 3, 4, 5], df: 10 },
      { term: 'spam', doc_id: 3, tf_title: 0, tf_heading: 0, tf_body: 1, positions: [100], df: 5 },

      // Doc 4 matches term2
      { term: 'term2', doc_id: 4, tf_title: 1, tf_heading: 0, tf_body: 0, positions: [], df: 20 },
    ];

    const results = rankDocuments(plan, postings, indexMeta, docLengths);

    // Verify Doc 3 is excluded because it contains 'spam'
    const doc3Result = results.find(r => r.doc_id === 3);
    expect(doc3Result).toBeUndefined();

    // Verify we have results for Doc 1, Doc 2, Doc 4
    expect(results.length).toBe(3);

    // Doc 1 should be ranked highest since it matches both term1 and term2
    expect(results[0].doc_id).toBe(1);
    expect(results[0].score).toBeGreaterThan(results[1].score);

    // Verify descending sort order
    expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
  });

  it('should fall back to stable sort by doc_id ascending on equal scores', () => {
    const plan: RetrievalPlan = {
      must: ['term1'],
      exclude: [],
    };

    // Docs 1 and 2 have identical features/postings and lengths
    const postings: PostingRow[] = [
      { term: 'term1', doc_id: 2, tf_title: 1, tf_heading: 0, tf_body: 0, positions: [], df: 10 },
      { term: 'term1', doc_id: 1, tf_title: 1, tf_heading: 0, tf_body: 0, positions: [], df: 10 },
    ];

    const equalDocLengths = new Map<number, number>([
      [1, 50],
      [2, 50],
    ]);

    const results = rankDocuments(plan, postings, indexMeta, equalDocLengths);

    expect(results.length).toBe(2);
    expect(results[0].score).toBe(results[1].score);
    
    // Doc 1 should come before Doc 2 due to its smaller ID (ascending secondary sort)
    expect(results[0].doc_id).toBe(1);
    expect(results[1].doc_id).toBe(2);
  });
});
