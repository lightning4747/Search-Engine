import { describe, it, expect } from 'vitest';
import { tokenize } from '../tokenizer.js';

describe('Tokenizer Module', () => {
  it('should return an empty array for empty or whitespace-only inputs', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
    expect(tokenize('\n\t  ')).toEqual([]);
  });

  it('should tokenize simple words with positions and offsets', () => {
    const text = 'hello world';
    const result = tokenize(text);
    
    expect(result).toEqual([
      { text: 'hello', startChar: 0, endChar: 5, position: 0 },
      { text: 'world', startChar: 6, endChar: 11, position: 1 }
    ]);
  });

  it('should split on standard punctuation boundaries', () => {
    const text = 'hello, world! yes... no? (parentheses)';
    const result = tokenize(text);
    
    expect(result.map(t => t.text)).toEqual([
      'hello',
      'world',
      'yes',
      'no',
      'parentheses'
    ]);

    // Verify correct offsets and positions
    expect(result[0]).toEqual({ text: 'hello', startChar: 0, endChar: 5, position: 0 });
    expect(result[1]).toEqual({ text: 'world', startChar: 7, endChar: 12, position: 1 });
  });

  it('should preserve internal hyphens for compound words', () => {
    const text = 'semi-structured state-of-the-art';
    const result = tokenize(text);

    expect(result.map(t => t.text)).toEqual([
      'semi-structured',
      'state-of-the-art'
    ]);
    expect(result[0]).toEqual({ text: 'semi-structured', startChar: 0, endChar: 15, position: 0 });
    expect(result[1]).toEqual({ text: 'state-of-the-art', startChar: 16, endChar: 32, position: 1 });
  });

  it('should preserve internal apostrophes for contractions', () => {
    const text = "don't user's it's";
    const result = tokenize(text);

    expect(result.map(t => t.text)).toEqual([
      "don't",
      "user's",
      "it's"
    ]);
    expect(result[0]).toEqual({ text: "don't", startChar: 0, endChar: 5, position: 0 });
  });

  it('should split URLs on punctuation boundaries', () => {
    const text = 'https://google.com/search?q=test';
    const result = tokenize(text);

    expect(result.map(t => t.text)).toEqual([
      'https',
      'google',
      'com',
      'search',
      'q',
      'test'
    ]);
  });

  it('should split decimal/formatted numbers on punctuation but keep simple numbers intact', () => {
    const text = '123 12.3 1,000';
    const result = tokenize(text);

    expect(result.map(t => t.text)).toEqual([
      '123',
      '12',
      '3',
      '1',
      '000'
    ]);
  });

  it('should handle leading/trailing hyphens or apostrophes by ignoring them as boundary punctuation', () => {
    const text = '-hello- - world- -';
    const result = tokenize(text);

    expect(result.map(t => t.text)).toEqual([
      'hello',
      'world'
    ]);
    expect(result[0]).toEqual({ text: 'hello', startChar: 1, endChar: 6, position: 0 });
  });
});
