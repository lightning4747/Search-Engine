import { describe, it, expect } from 'vitest';
import { processText } from '../pipeline.js';

describe('Text Processing Pipeline', () => {
  it('should process raw text through the full pipeline', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    const result = processText(text, 'body');

    // Expected stemmed terms (stopwords like 'the', 'over' removed)
    // quick -> quick
    // brown -> brown
    // fox -> fox
    // jumps -> jump
    // lazy -> lazi
    // dog -> dog
    expect(result.map(t => t.term)).toEqual([
      'quick',
      'brown',
      'fox',
      'jump',
      'lazi',
      'dog'
    ]);

    // Verify fields are correctly assigned
    expect(result.every(t => t.field === 'body')).toBe(true);
  });

  it('should verify position sequences are strictly contiguous starting from 0 after stopword removal', () => {
    const text = 'The and a is quick brown fox';
    const result = processText(text, 'title');

    // Stopwords 'the', 'and', 'a', 'is' are removed.
    // 'quick', 'brown', 'fox' remain.
    expect(result).toEqual([
      { term: 'quick', position: 0, field: 'title' },
      { term: 'brown', position: 1, field: 'title' },
      { term: 'fox', position: 2, field: 'title' }
    ]);
  });

  it('should handle complex headings and title structures', () => {
    const heading = '1.1 — Implementing Tokenizer Module!';
    const result = processText(heading, 'heading', { removeNumeric: true });

    // '1.1' is numeric/punctuation and gets removed (removeNumeric is true).
    // 'implementing' -> 'implement'
    // 'tokenizer' -> 'token'
    // 'module' -> 'modul'
    expect(result.map(t => t.term)).toEqual([
      'implement',
      'token',
      'modul'
    ]);
    expect(result.map(t => t.position)).toEqual([0, 1, 2]);
  });

  it('should return empty array for empty inputs', () => {
    expect(processText('', 'body')).toEqual([]);
    expect(processText('   ', 'body')).toEqual([]);
  });
});
