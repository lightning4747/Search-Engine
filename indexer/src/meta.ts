import { query } from './db/client.js';

/**
 * Ensures the single-row index_meta record exists.
 * If not present, inserts the default record with doc_count = 0, avg_doc_length = 0.
 */
export async function initializeMeta(): Promise<void> {
  const checkRes = await query('SELECT 1 FROM index_meta WHERE id = 1');
  if (checkRes.rowCount === 0) {
    await query(
      'INSERT INTO index_meta (id, doc_count, avg_doc_length, last_indexed_at) VALUES (1, 0, 0.0, CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING'
    );
  }
}

/**
 * Recalculates document statistics (doc_count and avg_doc_length) from all active crawled pages
 * in the database, and upserts these values into the index_meta table.
 * 
 * @returns The recalculated stats
 */
export async function recalculateMeta(): Promise<{ doc_count: number; avg_doc_length: number }> {
  // Recalculate stats from live active pages in crawled_pages
  const statsRes = await query(
    'SELECT COUNT(*)::int as count, COALESCE(AVG(doc_length), 0.0)::float as avg_len FROM crawled_pages WHERE is_active = true'
  );
  
  const docCount = statsRes.rows[0].count;
  const avgDocLength = statsRes.rows[0].avg_len;

  // Ensure row exists
  await initializeMeta();

  // Upsert the recalculated values
  await query(
    `INSERT INTO index_meta (id, doc_count, avg_doc_length, last_indexed_at) 
     VALUES (1, $1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET 
       doc_count = EXCLUDED.doc_count,
       avg_doc_length = EXCLUDED.avg_doc_length,
       last_indexed_at = EXCLUDED.last_indexed_at`,
    [docCount, avgDocLength]
  );

  return { doc_count: docCount, avg_doc_length: avgDocLength };
}
