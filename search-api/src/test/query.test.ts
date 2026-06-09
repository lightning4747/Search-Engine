import { describe, it, expect } from 'vitest';
import { processText, processQueryText } from '../query/queryPipeline.js';
import { parseQuery } from '../query/parser.js';

describe('Query Pipeline Module', () => {
  it('should process text identically to indexer (lowercase, punctuation, stopword removal, stemming)', () => {
    const text = 'The TypeScript generics are amazing!';
    const tokens = processText(text, 'body');

    // "the", "are" are stopwords.
    // "TypeScript" -> "typescript"
    // "generics" -> "gener" (or similar stem depending on porter stemmer - let's check: generics -> generic -> generic)
    // "amazing" -> "amaz" (stemmed)
    expect(tokens.map(t => t.term)).toContain('typescript');
    expect(tokens.map(t => t.term)).toContain('amaz');
    expect(tokens[0].position).toBe(0);
    expect(tokens[1].position).toBe(1);
  });

  it('should process simple query text to array of stems', () => {
    const stems = processQueryText('generics testing');
    expect(stems).toContain('gener');
    expect(stems).toContain('test');
  });
});

describe('Query Parser Module', () => {
  it('should parse simple keyword queries', () => {
    const plan = parseQuery('typescript generics');
    expect(plan.must).toContain('typescript');
    expect(plan.must).toContain('gener');
    expect(plan.exclude).toHaveLength(0);
    expect(plan.phrase).toHaveLength(0);
    expect(plan.proximity).toHaveLength(0);
  });

  it('should parse quoted phrases and add terms to must', () => {
    const plan = parseQuery('"exact phrase"');
    expect(plan.phrase).toEqual([{ terms: ['exact', 'phrase'] }]);
    expect(plan.must).toContain('exact');
    expect(plan.must).toContain('phrase');
  });

  it('should parse exclusion terms', () => {
    const plan = parseQuery('-javascript -web');
    expect(plan.exclude).toContain('javascript');
    expect(plan.exclude).toContain('web');
    expect(plan.must).toHaveLength(0);
  });

  it('should parse proximity clauses and add terms to must', () => {
    const plan = parseQuery('typescript ~5 generics');
    expect(plan.proximity).toEqual([{ terms: ['typescript', 'gener'], distance: 5 }]);
    expect(plan.must).toContain('typescript');
    expect(plan.must).toContain('gener');
  });

  it('should handle mixed queries', () => {
    const plan = parseQuery('typescript "exact phrase" -javascript');
    expect(plan.must).toContain('typescript');
    expect(plan.must).toContain('exact');
    expect(plan.must).toContain('phrase');
    expect(plan.phrase).toEqual([{ terms: ['exact', 'phrase'] }]);
    expect(plan.exclude).toContain('javascript');
  });

  it('should ignore stopwords in must, phrase, proximity, and exclude', () => {
    const plan = parseQuery('the typescript "the exact phrase" -the -javascript');
    // "the" is a stopword and should be removed from everywhere
    expect(plan.must).not.toContain('the');
    expect(plan.must).toContain('typescript');
    expect(plan.must).toContain('exact');
    expect(plan.must).toContain('phrase');
    expect(plan.phrase).toEqual([{ terms: ['exact', 'phrase'] }]);
    expect(plan.exclude).toContain('javascript');
    expect(plan.exclude).not.toContain('the');
  });
});
