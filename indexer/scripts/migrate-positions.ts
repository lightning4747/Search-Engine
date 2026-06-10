import { pool } from '../src/db/client.js';
import { compressPositions } from '../src/compression/positionCompress.js';

async function migrate() {
  console.log('Starting migration of postings table...');
  const client = await pool.connect();
  try {
    // 1. Alter table to add temporary column and segment column
    console.log('Adding temporary column positions_compressed and segment column...');
    await client.query('BEGIN');
    await client.query('ALTER TABLE postings ADD COLUMN IF NOT EXISTS positions_compressed BYTEA');
    await client.query('ALTER TABLE postings ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT \'hot\'');
    await client.query('COMMIT');

    // 2. Classify existing postings segment based on crawled_pages.crawled_at
    console.log('Initializing segment column based on document age...');
    await client.query('BEGIN');
    // Set postings to 'cold' if crawled more than 30 days ago
    await client.query(`
      UPDATE postings p
      SET segment = 'cold'
      FROM crawled_pages cp
      WHERE p.doc_id = cp.id AND cp.crawled_at < NOW() - INTERVAL '30 days'
    `);
    // Make segment NOT NULL
    await client.query('ALTER TABLE postings ALTER COLUMN segment SET NOT NULL');
    // Add check constraint
    await client.query('ALTER TABLE postings DROP CONSTRAINT IF EXISTS chk_segment');
    await client.query('ALTER TABLE postings ADD CONSTRAINT chk_segment CHECK (segment IN (\'hot\', \'cold\'))');
    await client.query('COMMIT');

    // 3. Fetch all postings rows to migrate positions
    console.log('Fetching all postings to convert positions arrays to compressed binary...');
    const res = await client.query('SELECT term_id, doc_id, positions FROM postings');
    console.log(`Found ${res.rows.length} postings rows to migrate.`);

    let count = 0;
    await client.query('BEGIN');
    for (const row of res.rows) {
      const { term_id, doc_id, positions } = row;
      // positions is a number[]
      const compressed = compressPositions(positions || []);
      await client.query(
        'UPDATE postings SET positions_compressed = $1 WHERE term_id = $2 AND doc_id = $3',
        [compressed, term_id, doc_id]
      );
      count++;
      if (count % 1000 === 0) {
        console.log(`Migrated ${count}/${res.rows.length} rows...`);
      }
    }
    await client.query('COMMIT');

    // 4. Drop old positions column and rename positions_compressed
    console.log('Finalizing schema changes...');
    await client.query('BEGIN');
    await client.query('ALTER TABLE postings ALTER COLUMN positions_compressed SET NOT NULL');
    await client.query('ALTER TABLE postings DROP COLUMN positions');
    await client.query('ALTER TABLE postings RENAME COLUMN positions_compressed TO positions');
    await client.query('COMMIT');

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed, rolling back...', err);
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

migrate();
