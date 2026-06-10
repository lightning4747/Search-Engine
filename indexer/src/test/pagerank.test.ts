import { describe, it, expect } from 'vitest';
import { computePageRank } from '../authority/pagerank.js';

describe('PageRank Scorer', () => {
  it('should return empty map for empty node set', () => {
    const nodes = new Set<number>();
    const adjacencyList = new Map<number, Set<number>>();
    const inboundList = new Map<number, Set<number>>();

    const result = computePageRank(nodes, adjacencyList, inboundList);
    expect(result.size).toBe(0);
  });

  it('should assign PageRank score of 1.0 for a single node', () => {
    const nodes = new Set<number>([1]);
    const adjacencyList = new Map<number, Set<number>>([[1, new Set<number>()]]);
    const inboundList = new Map<number, Set<number>>([[1, new Set<number>()]]);

    const result = computePageRank(nodes, adjacencyList, inboundList);
    expect(result.get(1)).toBeCloseTo(1.0, 5);
  });

  it('should verify scores sum to ~1.0 for a tiny link structure', () => {
    const nodes = new Set<number>([1, 2, 3]);
    const adjacencyList = new Map<number, Set<number>>([
      [1, new Set<number>([2])],
      [2, new Set<number>([3])],
      [3, new Set<number>([1])],
    ]);
    const inboundList = new Map<number, Set<number>>([
      [1, new Set<number>([3])],
      [2, new Set<number>([1])],
      [3, new Set<number>([2])],
    ]);

    const scores = computePageRank(nodes, adjacencyList, inboundList);
    
    let sum = 0;
    for (const score of scores.values()) {
      sum += score;
    }
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should handle dangling nodes without losing probability mass', () => {
    // Node 3 is a dangling node (no outbound links)
    const nodes = new Set<number>([1, 2, 3]);
    const adjacencyList = new Map<number, Set<number>>([
      [1, new Set<number>([2, 3])],
      [2, new Set<number>([3])],
      [3, new Set<number>()], // dangling
    ]);
    const inboundList = new Map<number, Set<number>>([
      [1, new Set<number>()],
      [2, new Set<number>([1])],
      [3, new Set<number>([1, 2])],
    ]);

    const scores = computePageRank(nodes, adjacencyList, inboundList);

    let sum = 0;
    for (const score of scores.values()) {
      sum += score;
    }
    expect(sum).toBeCloseTo(1.0, 5);

    // Node 3 has inbound links from 1 and 2, so it should have the highest score
    const pr1 = scores.get(1)!;
    const pr2 = scores.get(2)!;
    const pr3 = scores.get(3)!;

    expect(pr3).toBeGreaterThan(pr1);
    expect(pr3).toBeGreaterThan(pr2);
  });
});
