import { describe, it, expect } from 'vitest';
import { normalize, normalizeToken } from '../normalizer.js';
import { Token } from '../tokenizer.js';

describe('Normalizer Module', () => {
  it('should lowercase all token text', () => {
    const tokens: Token[] = [
      { text: 'HELLO', startChar: 0, endChar: 5, position: 0 },
      { text: 'WoRlD', startChar: 6, endChar: 11, position: 1 },
    ];
    const result = normalize(tokens);

    expect(result.map(t => t.text)).toEqual(['hello', 'world']);
    expect(result[0].startChar).toBe(0);
    expect(result[0].endChar).toBe(5);
  });

  it('should strip leading and trailing punctuation and update offsets', () => {
    const tokens: Token[] = [
      { text: '"hello"', startChar: 0, endChar: 7, position: 0 },
      { text: 'world,', startChar: 8, endChar: 14, position: 1 },
      { text: '(parenthesis)', startChar: 15, endChar: 28, position: 2 },
    ];
    const result = normalize(tokens);

    expect(result).toEqual([
      { text: 'hello', startChar: 1, endChar: 6, position: 0 },
      { text: 'world', startChar: 8, endChar: 13, position: 1 },
      { text: 'parenthesis', startChar: 16, endChar: 27, position: 2 },
    ]);
  });

  it('should not strip internal punctuation like hyphens and apostrophes', () => {
    const tokens: Token[] = [
      { text: 'semi-structured', startChar: 0, endChar: 15, position: 0 },
      { text: "don't", startChar: 16, endChar: 21, position: 1 },
    ];
    const result = normalize(tokens);

    expect(result.map(t => t.text)).toEqual(['semi-structured', "don't"]);
    expect(result[0]).toEqual({ text: 'semi-structured', startChar: 0, endChar: 15, position: 0 });
    expect(result[1]).toEqual({ text: "don't", startChar: 16, endChar: 21, position: 1 });
  });

  it('should filter out tokens that are purely punctuation', () => {
    const tokens: Token[] = [
      { text: '...', startChar: 0, endChar: 3, position: 0 },
      { text: '---', startChar: 4, endChar: 7, position: 1 },
    ];
    expect(normalize(tokens)).toEqual([]);
  });

  it('should optionally remove purely numeric tokens and preserve their positions', () => {
    const tokens: Token[] = [
      { text: 'page', startChar: 0, endChar: 4, position: 0 },
      { text: '123', startChar: 5, endChar: 8, position: 1 },
      { text: 'is', startChar: 9, endChar: 11, position: 2 },
    ];
    
    // Without removing numeric
    const resultKeep = normalize(tokens, { removeNumeric: false });
    expect(resultKeep.map(t => t.text)).toEqual(['page', '123', 'is']);
    expect(resultKeep[1].position).toBe(1);

    // With removing numeric
    const resultRemove = normalize(tokens, { removeNumeric: true });
    expect(resultRemove).toEqual([
      { text: 'page', startChar: 0, endChar: 4, position: 0 },
      { text: 'is', startChar: 9, endChar: 11, position: 2 },
    ]);
  });

  it('should ensure normalization is idempotent (running it again changes nothing)', () => {
    const token: Token = { text: 'Hello, World!', startChar: 0, endChar: 13, position: 0 };
    const step1 = normalizeToken(token);
    expect(step1).not.toBeNull();
    
    const step2 = normalizeToken(step1!);
    expect(step2).toEqual(step1);
  });
});
