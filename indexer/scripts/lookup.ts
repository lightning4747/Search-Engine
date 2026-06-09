import { query, closePool } from '../src/db/client.js';

async function main() {
  const term = process.argv[2];

  if (!term) {
    console.error('Usage: npx tsx scripts/lookup.ts <stemmed_term>');
    process.exit(1);
  }

  console.log(`Searching for term: "${term}"...`);

  try {
    const res = await query(
      `SELECT p.doc_id, p.tf_title, p.tf_heading, p.tf_body
       FROM postings p
       JOIN terms t ON p.term_id = t.term_id
       WHERE t.term = $1
       ORDER BY p.tf_body DESC, p.doc_id ASC`,
      [term]
    );

    if (res.rowCount === 0) {
      console.log(`No matching documents found for term "${term}".`);
      return;
    }

    console.log(`\nFound ${res.rowCount} matching document(s):`);
    console.log(`------------------------------------------------------------`);
    console.log(`Doc ID     | TF (Body) | TF (Title) | TF (Heading)`);
    console.log(`------------------------------------------------------------`);
    for (const row of res.rows) {
      const docIdStr = String(row.doc_id).padEnd(10);
      const tfBodyStr = String(row.tf_body).padEnd(9);
      const tfTitleStr = String(row.tf_title).padEnd(10);
      const tfHeadingStr = String(row.tf_heading).padEnd(12);
      console.log(`${docIdStr} | ${tfBodyStr} | ${tfTitleStr} | ${tfHeadingStr}`);
    }
    console.log(`------------------------------------------------------------`);

  } catch (error) {
    console.error('An error occurred during lookup:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
