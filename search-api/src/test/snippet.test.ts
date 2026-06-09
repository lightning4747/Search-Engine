import { describe, it, expect } from 'vitest';
import { generateSnippet } from '../ranking/snippet.js';

describe('Snippet Generator Module', () => {
  it('should return empty string for empty body text', () => {
    expect(generateSnippet({ bodyText: '', matchedTerms: ['test'], positions: new Map() })).toBe('');
  });

  it('should highlight matched terms and preserve original casing/punctuation', () => {
    const bodyText = 'This is a TypeScript testing document. We love generics and search engines.';
    // Non-stopwords in bodyText (lowercase, stripped punctuation):
    // 0: typescript (This, is, a are stopwords)
    // 1: testing
    // 2: document
    // 3: love
    // 4: generics
    // 5: search
    // 6: engines
    const matchedTerms = ['typescript', 'generics'];
    const positions = {
      'typescript': [0],
      'generics': [4]
    };

    const snippet = generateSnippet({ bodyText, matchedTerms, positions });

    // The matched terms should be wrapped in <mark> tags
    expect(snippet).toContain('<mark>TypeScript</mark>');
    expect(snippet).toContain('<mark>generics</mark>');
    
    // Non-matched text should remain unhighlighted but present
    expect(snippet).toContain('testing document');
  });

  it('should prevent raw HTML injection and XSS from body text', () => {
    const bodyText = 'Dangerous <script>alert("hack")</script> code with a match.';
    // Non-stopwords:
    // 0: dangerous
    // 1: script
    // 2: alert
    // 3: hack
    // 4: script
    // 5: code
    // 6: match
    const matchedTerms = ['match'];
    const positions = {
      'match': [6]
    };

    const snippet = generateSnippet({ bodyText, matchedTerms, positions });

    // HTML tags in the body text should be escaped
    expect(snippet).toContain('&lt;script&gt;');
    expect(snippet).not.toContain('<script>');
    
    // Our highlight tag should be rendered properly
    expect(snippet).toContain('<mark>match</mark>');
  });

  it('should find the highest-density window of hits', () => {
    // A document with query hits scattered and one dense area
    const bodyText = 'First keyword hit is here. And then a lot of filler words that do not match anything. ' +
      'But down here, we have a very dense area where keyword and keyword and keyword appear together.';
    
    // We match the word 'keyword'
    // First match is near the start
    // Then there are three matches close together near the end
    const matchedTerms = ['keyword'];
    const positions = {
      'keyword': [1, 10, 11, 12]
    };

    const snippet = generateSnippet({ bodyText, matchedTerms, positions });

    // The snippet should extract context around the dense area at the end (containing multiple highlighted 'keyword' terms)
    expect(snippet).toContain('<mark>keyword</mark> and <mark>keyword</mark> and <mark>keyword</mark>');
  });
});
