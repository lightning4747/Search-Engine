class TrieNode {
  children: Map<string, TrieNode> = new Map();
  term: string | null = null;
  docFrequency: number = 0;
}

/**
 * An in-memory prefix trie structure for auto-completion.
 * Stores terms along with their document frequencies.
 * Supports insertions and sorted prefix completions retrieval.
 */
export class PrefixTrie {
  root: TrieNode = new TrieNode();

  /**
   * Inserts a term into the trie with its document frequency.
   */
  insert(term: string, docFrequency: number): void {
    if (!term) return;
    let node = this.root;
    for (const char of term) {
      let nextNode = node.children.get(char);
      if (!nextNode) {
        nextNode = new TrieNode();
        node.children.set(char, nextNode);
      }
      node = nextNode;
    }
    node.term = term;
    node.docFrequency = docFrequency;
  }

  /**
   * Returns true if the exact term exists in the trie.
   */
  exists(term: string): boolean {
    if (!term) return false;
    let node = this.root;
    for (const char of term) {
      const nextNode = node.children.get(char);
      if (!nextNode) return false;
      node = nextNode;
    }
    return node.term === term;
  }

  /**
   * Searches for all terms in the trie that start with the given prefix.
   * Returns them sorted by docFrequency descending (and alphabetically as secondary sort).
   */
  search(prefix: string): { term: string; docFrequency: number }[] {
    let node = this.root;
    for (const char of prefix) {
      const nextNode = node.children.get(char);
      if (!nextNode) {
        return [];
      }
      node = nextNode;
    }

    const results: { term: string; docFrequency: number }[] = [];
    
    function dfs(curr: TrieNode) {
      if (curr.term !== null) {
        results.push({ term: curr.term, docFrequency: curr.docFrequency });
      }
      for (const child of curr.children.values()) {
        dfs(child);
      }
    }

    dfs(node);

    return results.sort((a, b) => {
      if (b.docFrequency !== a.docFrequency) {
        return b.docFrequency - a.docFrequency;
      }
      return a.term.localeCompare(b.term);
    });
  }
}
