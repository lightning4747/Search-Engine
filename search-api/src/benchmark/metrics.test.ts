import { describe, it, expect } from 'vitest';
import {
  percentile,
  computeNDCG,
  computeMRR,
  analyzeLatencies
} from './metrics.js';

describe('metrics module tests', () => {
  describe('percentile', () => {
    it('should calculate the median (p50) of [1,2,3,4,5]', () => {
      const sorted = [1, 2, 3, 4, 5];
      expect(percentile(sorted, 50)).toBe(3);
    });

    it('should calculate the p95 of [1,2,3,4,5]', () => {
      const sorted = [1, 2, 3, 4, 5];
      expect(percentile(sorted, 95)).toBeCloseTo(4.8, 1);
    });
  });

  describe('computeNDCG', () => {
    it('should compute NDCG correctly with given relevance judgments', () => {
      const retrieved = ['a', 'b', 'c'];
      const judgments = new Map([
        ['a', 2],
        ['b', 1],
        ['c', 0]
      ]);
      // DCG@3 = (2^2 - 1)/log2(2) + (2^1 - 1)/log2(3) + (2^0 - 1)/log2(4)
      //       = 3/1 + 1/1.5849625 + 0 = 3 + 0.6309297 = 3.6309297
      // IDCG@3 = DCG@3 because retrieved list is already in ideal order.
      // NDCG = DCG / IDCG = 1.0
      expect(computeNDCG(retrieved, judgments, 3)).toBeCloseTo(1.0, 4);

      // Non-ideal ordering: retrieved = ['b', 'a', 'c']
      // DCG@3 = (2^1 - 1)/log2(2) + (2^2 - 1)/log2(3) + (2^0 - 1)/log2(4)
      //       = 1/1 + 3/1.5849625 + 0 = 1 + 1.892789 = 2.892789
      // NDCG = 2.892789 / 3.6309297 = 0.796707
      expect(computeNDCG(['b', 'a', 'c'], judgments, 3)).toBeCloseTo(0.796707, 4);
    });
  });

  describe('computeMRR', () => {
    it('should compute MRR correctly for queries', () => {
      const results = [
        { query: 'q1', retrievedIds: ['doc1', 'doc2', 'doc3'] }, // first relevant is doc2 (rank 2) -> 1/2
        { query: 'q2', retrievedIds: ['doc4', 'doc5', 'doc6'] }  // first relevant is doc4 (rank 1) -> 1/1
      ];

      const judgments = new Map([
        ['q1', new Map([['doc1', 0], ['doc2', 2], ['doc3', 1]])],
        ['q2', new Map([['doc4', 1], ['doc5', 0], ['doc6', 0]])]
      ]);

      // MRR = (1/2 + 1/1) / 2 = 0.75
      expect(computeMRR(results, judgments)).toBe(0.75);
    });
  });
});
