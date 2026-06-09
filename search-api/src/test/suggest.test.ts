import { describe, it, expect } from 'vitest';
import { PrefixTrie } from '../suggest/trie.js';

describe('Prefix Trie Module', () => {
  it('should insert and retrieve terms by prefix', () => {
    const trie = new PrefixTrie();
    trie.insert('typescript', 10);
    trie.insert('testing', 5);
    trie.insert('type', 20);

    const res = trie.search('type');
    expect(res).toHaveLength(2);
    // 'type' (docFreq 20) and 'typescript' (docFreq 10)
    expect(res[0].term).toBe('type');
    expect(res[1].term).toBe('typescript');
  });

  it('should sort completions by docFrequency descending, and alphabetically on tie-breaker', () => {
    const trie = new PrefixTrie();
    trie.insert('apricot', 10);
    trie.insert('apple', 10);
    trie.insert('banana', 15);
    trie.insert('application', 20);

    const res = trie.search('ap');
    expect(res).toHaveLength(3);
    
    // 1st: application (docFreq 20)
    // 2nd: apple (docFreq 10, alphabetically first)
    // 3rd: apricot (docFreq 10)
    expect(res[0].term).toBe('application');
    expect(res[1].term).toBe('apple');
    expect(res[2].term).toBe('apricot');
  });

  it('should return empty list when no terms match prefix', () => {
    const trie = new PrefixTrie();
    trie.insert('apple', 10);
    const res = trie.search('xyz');
    expect(res).toHaveLength(0);
  });
});
