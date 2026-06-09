import { PrefixTrie } from './trie.js';
import { query } from '../db/client.js';
import { performance } from 'perf_hooks';

export const trie = new PrefixTrie();

/**
 * Loads all terms and their document frequencies from the terms database table
 * and inserts them into the in-memory prefix trie.
 * Logs build duration, term counts, and memory usage statistics.
 */
export async function loadTrie(): Promise<void> {
  const start = performance.now();
  const startMemory = process.memoryUsage().heapUsed;

  console.log('Loading suggestions prefix trie from database...');

  try {
    const res = await query('SELECT term, doc_frequency FROM terms');
    let count = 0;
    for (const row of res.rows) {
      if (row.term) {
        trie.insert(row.term, parseInt(row.doc_frequency || '0', 10));
        count++;
      }
    }

    const elapsed = (performance.now() - start).toFixed(2);
    const endMemory = process.memoryUsage().heapUsed;
    const memoryDiff = ((endMemory - startMemory) / 1024 / 1024).toFixed(2);

    console.log(`Prefix trie built successfully in ${elapsed}ms.`);
    console.log(`- Total terms loaded: ${count}`);
    console.log(`- Memory usage increase: ${memoryDiff} MB`);
    console.log(`- Total heap used: ${(endMemory / 1024 / 1024).toFixed(2)} MB`);

  } catch (err) {
    console.error('Failed to load terms into prefix trie:', err);
    throw err;
  }
}
