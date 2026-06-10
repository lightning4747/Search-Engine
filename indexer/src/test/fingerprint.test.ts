import { describe, it, expect } from 'vitest';
import { computeSimHash, hammingDistance } from '../dedup/fingerprint.js';

describe('Document Fingerprint & Near-Duplicate Module', () => {
  it('should generate identical fingerprints for identical term sets', () => {
    const terms1 = ['the', 'quick', 'brown', 'fox', 'jumps'];
    const terms2 = ['the', 'quick', 'brown', 'fox', 'jumps'];

    const f1 = computeSimHash(terms1);
    const f2 = computeSimHash(terms2);

    expect(f1).toBe(f2);
    expect(hammingDistance(f1, f2)).toBe(0);
  });

  it('should generate similar fingerprints for slightly modified documents (small Hamming distance)', () => {
    // 9 out of 10 terms identical
    const terms1 = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy', 'dog', 'one'];
    const terms2 = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy', 'dog', 'two'];

    const f1 = computeSimHash(terms1);
    const f2 = computeSimHash(terms2);

    const distance = hammingDistance(f1, f2);
    // Standard SimHash properties: slight changes yield a very small distance (typically <= 8)
    expect(distance).toBeLessThanOrEqual(8);
  });

  it('should generate distinct fingerprints for unrelated documents (larger Hamming distance)', () => {
    const terms1 = ['typescript', 'generic', 'compiler', 'react', 'hooks'];
    const terms2 = ['apples', 'oranges', 'bananas', 'nutrition', 'recipe'];

    const f1 = computeSimHash(terms1);
    const f2 = computeSimHash(terms2);

    const distance = hammingDistance(f1, f2);
    // Unrelated documents should have a significantly larger Hamming distance (typically around 20-30 on average)
    expect(distance).toBeGreaterThan(10);
  });

  it('should return 64-bit zero hash for empty term list', () => {
    const f = computeSimHash([]);
    expect(f).toBe('0000000000000000');
  });

  it('should correctly measure exact boundary distances', () => {
    const fZero = '0000000000000000';
    const fMax = 'ffffffffffffffff';
    expect(hammingDistance(fZero, fMax)).toBe(64);

    const fOneBit = '0000000000000001';
    expect(hammingDistance(fZero, fOneBit)).toBe(1);
  });
});
