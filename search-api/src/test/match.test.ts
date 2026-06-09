import { describe, it, expect } from 'vitest';
import { matchPhrase } from '../query/phraseMatch.js';
import { matchProximity } from '../query/proximityMatch.js';

describe('Phrase Matching Module', () => {
  it('should pass for true consecutive match', () => {
    const list1 = [10, 20, 30];
    const list2 = [11, 22, 35];
    // Match at offset 1: 10 + 1 = 11, which exists in list2
    expect(matchPhrase([list1, list2])).toBe(true);
  });

  it('should fail if gap of 1 (difference of 2) occurs', () => {
    const list1 = [10, 20];
    const list2 = [12, 22];
    // No consecutive match (10 -> 12 is gap of 1, 20 -> 22 is gap of 1)
    expect(matchPhrase([list1, list2])).toBe(false);
  });

  it('should pass for multi-term phrase matches', () => {
    const list1 = [10, 100];
    const list2 = [11, 105];
    const list3 = [12, 110];
    
    // Consecutive sequence: 10 -> 11 -> 12
    expect(matchPhrase([list1, list2, list3])).toBe(true);
  });

  it('should fail for multi-term phrase with gap at any point', () => {
    const list1 = [10, 100];
    const list2 = [11, 105];
    const list3 = [13, 110];
    
    // sequence 10 -> 11 is consecutive, but 11 -> 13 is not.
    // sequence 100 -> 105 is not consecutive.
    expect(matchPhrase([list1, list2, list3])).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(matchPhrase([])).toBe(false);
    expect(matchPhrase([[10, 20]])).toBe(true);
    expect(matchPhrase([[10], []])).toBe(false);
  });
});

describe('Proximity Matching Module', () => {
  it('should pass when min distance is exactly N', () => {
    const pos1 = [10, 100];
    const pos2 = [15, 120];
    // |10 - 15| = 5
    expect(matchProximity(pos1, pos2, 5)).toBe(true);
  });

  it('should fail when min distance is N + 1', () => {
    const pos1 = [10, 100];
    const pos2 = [16, 120];
    // |10 - 16| = 6, |100 - 16| = 84, |100 - 120| = 20 -> min distance is 6 > 5
    expect(matchProximity(pos1, pos2, 5)).toBe(false);
  });

  it('should pass when pos1 is after pos2', () => {
    const pos1 = [15, 100];
    const pos2 = [10, 120];
    // |15 - 10| = 5
    expect(matchProximity(pos1, pos2, 5)).toBe(true);
  });

  it('should handle edge cases', () => {
    expect(matchProximity([], [10], 5)).toBe(false);
    expect(matchProximity([10], [], 5)).toBe(false);
  });
});
