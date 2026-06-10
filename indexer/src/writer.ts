import { pool } from './db/client.js';
import { DocumentIndex } from './indexDocument.js';
import { compressPositions } from './compression/positionCompress.js';


/**
 * Writes a batch of DocumentIndex objects to the database inside a single transaction.
 * Handles upserting into the terms table, clearing old postings for the doc_ids
 * (for re-indexing safety), inserting new postings, updating term document frequencies,
 * and marking the pages as indexed.
 * 
 * @param batch Array of DocumentIndex objects to write
 */
export async function writeIndexBatch(batch: DocumentIndex[]): Promise<void> {
  if (batch.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const docIds = batch.map(d => d.docId);

    // 1. Capture the term_ids associated with these documents BEFORE deleting their old postings.
    // This is crucial to ensure that if a term is removed during re-indexing, its doc_frequency
    // is correctly recalculated and updated (eventually to 0 if no other document contains it).
    const oldTermIdsRes = await client.query(
      'SELECT DISTINCT term_id FROM postings WHERE doc_id = ANY($1::int[])',
      [docIds]
    );
    const affectedTermIds = new Set<number>(oldTermIdsRes.rows.map(r => r.term_id));

    // 2. Collect all unique terms across all documents in this batch
    const uniqueTerms = new Set<string>();
    for (const doc of batch) {
      for (const term of doc.terms.keys()) {
        uniqueTerms.add(term);
      }
    }

    // 3. Upsert unique terms and retrieve/cache their term_ids
    const termIdMap = new Map<string, number>();
    for (const term of uniqueTerms) {
      const res = await client.query(
        `INSERT INTO terms (term, doc_frequency) 
         VALUES ($1, 0)
         ON CONFLICT (term) DO UPDATE SET term = EXCLUDED.term
         RETURNING term_id`,
        [term]
      );
      const termId = res.rows[0].term_id;
      termIdMap.set(term, termId);
      affectedTermIds.add(termId); // Also mark this new/updated term as affected
    }

    // 4. Delete old postings for these docIds before inserting new ones (re-indexing safety)
    await client.query(
      'DELETE FROM postings WHERE doc_id = ANY($1::int[])',
      [docIds]
    );

    const thresholdDays = parseInt(process.env.HOT_SEGMENT_THRESHOLD_DAYS || '30', 10);
    const now = new Date();

    // 5. Insert postings for each document
    for (const doc of batch) {
      const docCrawledAt = doc.crawledAt || now;
      const ageInMs = now.getTime() - docCrawledAt.getTime();
      const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
      const segment = ageInDays <= thresholdDays ? 'hot' : 'cold';

      for (const [term, info] of doc.terms.entries()) {
        const termId = termIdMap.get(term);
        if (termId === undefined) continue;

        const compressedPositions = compressPositions(info.positions);

        await client.query(
          `INSERT INTO postings (term_id, doc_id, tf_title, tf_heading, tf_body, positions, segment)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (term_id, doc_id) DO UPDATE SET
             tf_title = EXCLUDED.tf_title,
             tf_heading = EXCLUDED.tf_heading,
             tf_body = EXCLUDED.tf_body,
             positions = EXCLUDED.positions,
             segment = EXCLUDED.segment`,
          [
            termId,
            doc.docId,
            info.tf_title,
            info.tf_heading,
            info.tf_body,
            compressedPositions,
            segment,
          ]
        );
      }
    }

    // 6. Update the doc_frequency for all terms that were affected (added, modified, or removed)
    if (affectedTermIds.size > 0) {
      await client.query(
        `UPDATE terms t
         SET doc_frequency = (
           SELECT COUNT(*) FROM postings p WHERE p.term_id = t.term_id
         )
         WHERE t.term_id = ANY($1::int[])`,
        [Array.from(affectedTermIds)]
      );
    }

    // 7. Mark the crawled pages as indexed and save their fingerprints
    const fingerprints = batch.map(d => d.fingerprint);
    await client.query(
      `UPDATE crawled_pages AS cp
       SET 
         indexed_at = CURRENT_TIMESTAMP,
         doc_fingerprint = val.doc_fingerprint
       FROM (
         SELECT 
           UNNEST($1::int[]) AS id,
           UNNEST($2::text[]) AS doc_fingerprint
       ) AS val
       WHERE cp.id = val.id`,
      [docIds, fingerprints]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
