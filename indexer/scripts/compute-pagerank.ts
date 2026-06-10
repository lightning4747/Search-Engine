import { loadLinkGraph } from '../src/authority/graphLoader.js';
import { computePageRank } from '../src/authority/pagerank.js';
import { persistAuthorityScores } from '../src/authority/persistScores.js';
import { closePool } from '../src/db/client.js';

async function main() {
  console.log('--- Initializing PageRank Computation ---');
  const startTime = Date.now();

  try {
    // 1. Load the link graph
    console.log('Loading link graph from database...');
    const graph = await loadLinkGraph();
    console.log(`Link graph loaded: ${graph.nodes.size} active documents.`);

    if (graph.nodes.size === 0) {
      console.log('No active documents found in the database. PageRank skipped.');
      return;
    }

    // 2. Compute PageRank
    console.log('Computing PageRank scores...');
    const scores = computePageRank(
      graph.nodes,
      graph.adjacencyList,
      graph.inboundList
    );

    // 3. Persist normalized scores
    console.log('Normalizing and persisting scores to crawled_pages...');
    await persistAuthorityScores(scores, graph.adjacencyList, graph.inboundList);

    const elapsed = Date.now() - startTime;
    console.log(`PageRank pipeline completed successfully in ${elapsed}ms.`);

  } catch (error) {
    console.error('An error occurred during PageRank execution:', error);
    process.exitCode = 1;
  } finally {
    console.log('Closing database connection pool...');
    await closePool();
  }
}

main();
