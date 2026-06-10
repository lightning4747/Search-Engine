import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { damerauLevenshtein, suggestCorrection } from '../query/spellCheck.js';
import { trie, commonTerms } from '../suggest/trieLoader.js';

describe('Spell Check Module', () => {
  beforeAll(() => {
    // Populate trie and commonTerms for unit testing
    trie.insert('express', 100);
    trie.insert('crawler', 50);
    trie.insert('search', 80);
    trie.insert('api', 90);

    commonTerms.push({ term: 'express', docFrequency: 100 });
    commonTerms.push({ term: 'crawler', docFrequency: 50 });
    commonTerms.push({ term: 'search', docFrequency: 80 });
    commonTerms.push({ term: 'api', docFrequency: 90 });
  });

  afterAll(() => {
    commonTerms.length = 0;
  });

  describe('Damerau-Levenshtein distance', () => {
    it('should calculate correct distance for basic operations', () => {
      expect(damerauLevenshtein('cat', 'cat')).toBe(0);
      expect(damerauLevenshtein('cat', 'cot')).toBe(1); // Substitution
      expect(damerauLevenshtein('cat', 'act')).toBe(1); // Transposition
      expect(damerauLevenshtein('cat', 'cats')).toBe(1); // Insertion
      expect(damerauLevenshtein('cat', 'ca')).toBe(1); // Deletion
      expect(damerauLevenshtein('baking', 'abking')).toBe(1); // Transposition
      expect(damerauLevenshtein('ca', 'ac')).toBe(1); // Transposition
      expect(damerauLevenshtein('python', 'pythno')).toBe(1); // Transposition
    });

    it('should calculate distance for complex changes', () => {
      expect(damerauLevenshtein('something', 'sweet')).toBe(6);
      expect(damerauLevenshtein('', 'word')).toBe(4);
      expect(damerauLevenshtein('word', '')).toBe(4);
    });
  });

  describe('Query Correction suggestions', () => {
    it('should return null for queries with no misspellings', () => {
      expect(suggestCorrection('express crawler')).toBeNull();
      expect(suggestCorrection('search api')).toBeNull();
    });

    it('should suggest corrections for single word misspellings', () => {
      expect(suggestCorrection('crwler')).toBe('crawler');
      expect(suggestCorrection('exprees')).toBe('express');
    });

    it('should handle multi-word queries with some misspelled words', () => {
      expect(suggestCorrection('express crwler')).toBe('express crawler');
      expect(suggestCorrection('srch api')).toBe('search api');
    });

    it('should preserve surrounding punctuation, hyphens, and spaces', () => {
      expect(suggestCorrection('express -crwler')).toBe('express -crawler');
      expect(suggestCorrection('"crwler" api')).toBe('"crawler" api');
    });
  });
});
