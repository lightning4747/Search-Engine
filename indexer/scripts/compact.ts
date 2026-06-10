import { pool } from '../src/db/client.js';
import { recalculateMeta } from '../src/meta.js';

async function compact() {
  console.log('Starting index compaction job...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Promote hot -> cold postings older than threshold
    const thresholdDays = parseInt(process.env.HOT_SEGMENT_THRESHOLD_DAYS || '30', 10);
    console.log(`Promoting hot postings to cold for documents older than ${thresholdDays} days...`);
    const promoteRes = await client.query(
      `UPDATE postings
       SET segment = 'cold'
       WHERE segment = 'hot'
         AND doc_id IN (
           SELECT id FROM crawled_pages WHERE crawled_at < NOW() - ($1 * INTERVAL '1 day')
         )`,
      [thresholdDays]
    );
    console.log(`Promoted ${promoteRes.rowCount || 0} postings rows to cold.`);

    // 2. Purge postings for is_active = false documents
    console.log('Identifying terms affected by inactive documents...');
    const affectedTermsRes = await client.query(
      `SELECT DISTINCT term_id FROM postings
       WHERE doc_id IN (SELECT id FROM crawled_pages WHERE is_active = false)`
    );
    const affectedTermIds = affectedTermsRes.rows.map(r => r.term_id);

    console.log(`Purging postings for inactive documents (is_active = false)...`);
    const deleteRes = await client.query(
      `DELETE FROM postings
       WHERE doc_id IN (SELECT id FROM crawled_pages WHERE is_active = false)`
    );
    console.log(`Purged ${deleteRes.rowCount || 0} postings rows.`);

    // 3. Update doc_frequency for affected terms
    if (affectedTermIds.length > 0) {
      console.log(`Recalculating document frequency for ${affectedTermIds.length} affected terms...`);
      const updateFreqRes = await client.query(
        `UPDATE terms t
         SET doc_frequency = (
           SELECT COUNT(*) FROM postings p WHERE p.term_id = t.term_id
         )
         WHERE t.term_id = ANY($1::int[])`,
        [affectedTermIds]
      );
      console.log(`Recalculated doc frequency for ${updateFreqRes.rowCount || 0} terms.`);
    } else {
      console.log('No terms affected by inactive postings purge.');
    }

    await client.query('COMMIT');

    // 4. Rebuild index_meta stats (using separate client query or inside pool connection)
    console.log('Recalculating global index metadata...');
    const meta = await recalculateMeta();
    console.log(`Global index metadata updated: doc_count = ${meta.doc_count}, avg_doc_length = ${meta.avg_doc_length.toFixed(2)}`);

    console.log('Index compaction completed successfully!');
  } catch (err) {
    console.error('Compaction failed, rolling back...', err);
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('Rollback failed:', rbErr);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

compact();
