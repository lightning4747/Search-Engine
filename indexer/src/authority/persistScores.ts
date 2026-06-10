import { query, pool } from '../db/client.js';

/**
 * Normalizes PageRank scores to the [0, 1] range and persists them 
 * along with in/out link counts to the crawled_pages table in a single transaction.
 *
 * @param scores Map of doc_id to raw PageRank score
 * @param adjacencyList Map of doc_id to Set of out-links (used for out_link_count)
 * @param inboundList Map of doc_id to Set of in-links (used for in_link_count)
 */
export async function persistAuthorityScores(
  scores: Map<number, number>,
  adjacencyList: Map<number, Set<number>>,
  inboundList: Map<number, Set<number>>
): Promise<void> {
  const docIds = Array.from(scores.keys());
  if (docIds.length === 0) {
    console.log('No documents to persist PageRank scores for.');
    return;
  }

  // 1. Min-max normalization
  let minScore = Infinity;
  let maxScore = -Infinity;
  for (const score of scores.values()) {
    if (score < minScore) minScore = score;
    if (score > maxScore) maxScore = score;
  }
  
  const range = maxScore - minScore;

  // 2. Prepare arrays for batch Postgres update using UNNEST
  const ids: number[] = [];
  const normalizedScores: number[] = [];
  const inCounts: number[] = [];
  const outCounts: number[] = [];

  for (const docId of docIds) {
    const score = scores.get(docId) || 0;
    // Handle edge case where range is 0 (e.g. single node or all nodes have identical scores)
    const normScore = range > 0 ? (score - minScore) / range : 1.0;
    
    const outCount = adjacencyList.get(docId)?.size || 0;
    const inCount = inboundList.get(docId)?.size || 0;

    ids.push(docId);
    normalizedScores.push(normScore);
    inCounts.push(inCount);
    outCounts.push(outCount);
  }

  // 3. Execute in a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE crawled_pages AS cp
       SET 
         authority_score = val.authority_score,
         in_link_count = val.in_link_count,
         out_link_count = val.out_link_count
       FROM (
         SELECT 
           UNNEST($1::int[]) AS id,
           UNNEST($2::float8[]) AS authority_score,
           UNNEST($3::int[]) AS in_link_count,
           UNNEST($4::int[]) AS out_link_count
       ) AS val
       WHERE cp.id = val.id`,
      [ids, normalizedScores, inCounts, outCounts]
    );

    await client.query('COMMIT');
    console.log(`Successfully persisted PageRank authority scores for ${docIds.length} documents.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to persist authority scores:', error);
    throw error;
  } finally {
    client.release();
  }
}
