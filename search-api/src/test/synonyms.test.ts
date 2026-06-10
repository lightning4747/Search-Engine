import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query, pool } from '../db/client.js';
import { loadSynonyms, getSynonyms } from '../query/synonyms.js';
import { retrievePostings } from '../query/retrieval.js';
import { rankDocuments, PostingRow, IndexMeta, RetrievalPlan } from '../ranking/ranker.js';

describe('Synonym Map Expansion Module', () => {
  beforeAll(async () => {
    // 1. Manually setup dummy synonyms in synonym utility for testing if synonyms.json loaded
    loadSynonyms();
  });

  describe('synonym retrieval', () => {
    it('should map terms to synonyms properly after stemming', () => {
      // 'js' stems to 'js', 'javascript' stems to 'javascript'
      expect(getSynonyms('js')).toContain('javascript');
      expect(getSynonyms('javascript')).toContain('js');
    });

    it('should return empty array for terms with no synonyms', () => {
      expect(getSynonyms('unknown')).toEqual([]);
    });
  });

  describe('synonym rank scoring', () => {
    const indexMeta: IndexMeta = {
      doc_count: 10,
      avg_doc_length: 50,
    };

    const docLengths = new Map<number, number>([
      [1, 50],
      [2, 50],
    ]);

    it('should rank exact matches higher than synonym matches due to synonymBoost discount', () => {
      const plan: RetrievalPlan = {
        must: ['js'],
        exclude: [],
      };

      // Doc 1 contains exact term 'js'
      // Doc 2 contains synonym term 'javascript'
      const postings: PostingRow[] = [
        { term: 'js', doc_id: 1, tf_title: 1, tf_heading: 0, tf_body: 0, positions: [], df: 2, segment: 'cold' },
        { term: 'javascript', doc_id: 2, tf_title: 1, tf_heading: 0, tf_body: 0, positions: [], df: 2, segment: 'cold' },
      ];

      // Rank with synonymBoost = 0.5
      const results = rankDocuments(plan, postings, indexMeta, docLengths, undefined, undefined, undefined, undefined, 0.2, new Set(), 1.0, 0.5);

      expect(results.length).toBe(2);
      // Doc 1 (exact match) should be ranked higher than Doc 2 (synonym match)
      expect(results[0].doc_id).toBe(1);
      expect(results[1].doc_id).toBe(2);
      expect(results[0].score).toBeCloseTo(results[1].score * 2, 5); // Exact matches outscore synonym matches by 2x (1 / 0.5)
    });
  });
});
