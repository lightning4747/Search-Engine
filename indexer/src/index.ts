import { query, closePool, pool } from './db/client.js';
import { loadUnindexedPages, CrawledPage } from './loader.js';
import { indexDocument } from './indexDocument.js';
import { writeIndexBatch } from './writer.js';
import { initializeMeta, recalculateMeta } from './meta.js';

async function main() {
  const args = process.argv.slice(2);
  let batchSize = 500;
  let dryRun = false;
  let reindexAll = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch-size') {
      const val = parseInt(args[i + 1], 10);
      if (!isNaN(val)) {
        batchSize = val;
        i++;
      }
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--reindex-all') {
      reindexAll = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Indexer CLI

Options:
  --batch-size <n>   Number of documents to process in each batch (default: 500)
  --dry-run          Simulate the index build without writing to the database
  --reindex-all      Clear existing terms/postings and re-index all active pages
  --help, -h         Show this help message
      `);
      process.exit(0);
    }
  }

  console.log(`Starting indexer run...`);
  console.log(`Config: batchSize=${batchSize}, dryRun=${dryRun}, reindexAll=${reindexAll}`);

  const overallStartTime = Date.now();

  try {
    // 1. Get initial term count if not dryRun
    let startTermCount = 0;
    if (!dryRun) {
      const startTermCountRes = await query('SELECT COUNT(*)::int as count FROM terms');
      startTermCount = startTermCountRes.rows[0].count;
    }

    // 2. Handle reindex-all
    if (reindexAll) {
      if (dryRun) {
        console.log(`[dry-run] Would clear postings, terms, index_meta, and reset indexed_at on crawled_pages`);
      } else {
        console.log(`Clearing existing index tables...`);
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('DELETE FROM postings');
          await client.query('DELETE FROM terms');
          await client.query('DELETE FROM index_meta');
          await client.query('UPDATE crawled_pages SET indexed_at = NULL WHERE is_active = true');
          await client.query('COMMIT');
          console.log(`Index cleared successfully.`);
          startTermCount = 0; // Since terms table is cleared
        } catch (e) {
          await client.query('ROLLBACK');
          console.error(`Failed to clear index:`, e);
          throw e;
        } finally {
          client.release();
        }
      }
    }

    // 3. Count total documents to index
    let totalUnindexed = 0;
    if (reindexAll && dryRun) {
      // In dry-run reindex-all, simulate by loading all active pages
      const res = await query('SELECT COUNT(*)::int as count FROM crawled_pages WHERE is_active = true');
      totalUnindexed = res.rows[0].count;
    } else {
      const res = await query('SELECT COUNT(*)::int as count FROM crawled_pages WHERE is_active = true AND indexed_at IS NULL');
      totalUnindexed = res.rows[0].count;
    }

    console.log(`Total documents to index: ${totalUnindexed}`);
    const totalBatches = Math.ceil(totalUnindexed / batchSize);

    // 4. Batch indexing loop
    let totalIndexedDocs = 0;
    let batchIndex = 1;
    let lastId = 0;

    while (true) {
      let pages: CrawledPage[] = [];

      if (reindexAll && dryRun) {
        // Query active pages sequentially by ID to prevent infinite loop
        const res = await query(
          `SELECT id, url_id, title, description, canonical_url, headings, text_content, 
                  crawled_at, doc_length, word_count, is_active, indexed_at
           FROM crawled_pages
           WHERE is_active = true AND id > $1
           ORDER BY id ASC
           LIMIT $2`,
          [lastId, batchSize]
        );
        pages = res.rows.map(row => ({
          id: row.id,
          url_id: row.url_id,
          title: row.title,
          description: row.description,
          canonical_url: row.canonical_url,
          headings: typeof row.headings === 'string' ? JSON.parse(row.headings) : row.headings,
          text_content: row.text_content,
          crawled_at: new Date(row.crawled_at),
          doc_length: Number(row.doc_length),
          word_count: Number(row.word_count),
          is_active: row.is_active,
          indexed_at: row.indexed_at ? new Date(row.indexed_at) : null,
        }));
      } else if (dryRun) {
        // Incremental dry run, load unindexed pages by ID
        const res = await query(
          `SELECT id, url_id, title, description, canonical_url, headings, text_content, 
                  crawled_at, doc_length, word_count, is_active, indexed_at
           FROM crawled_pages
           WHERE is_active = true AND indexed_at IS NULL AND id > $1
           ORDER BY id ASC
           LIMIT $2`,
          [lastId, batchSize]
        );
        pages = res.rows.map(row => ({
          id: row.id,
          url_id: row.url_id,
          title: row.title,
          description: row.description,
          canonical_url: row.canonical_url,
          headings: typeof row.headings === 'string' ? JSON.parse(row.headings) : row.headings,
          text_content: row.text_content,
          crawled_at: new Date(row.crawled_at),
          doc_length: Number(row.doc_length),
          word_count: Number(row.word_count),
          is_active: row.is_active,
          indexed_at: row.indexed_at ? new Date(row.indexed_at) : null,
        }));
      } else {
        // Live indexing, load normally
        pages = await loadUnindexedPages(batchSize);
      }

      if (pages.length === 0) break;

      const batchStartTime = Date.now();
      const documentIndices = pages.map(indexDocument);

      if (!dryRun) {
        await writeIndexBatch(documentIndices);
      }

      const elapsed = Date.now() - batchStartTime;
      console.log(`[batch ${batchIndex}/${totalBatches}] indexed ${pages.length} docs, elapsed ${elapsed}ms`);

      totalIndexedDocs += pages.length;
      lastId = pages[pages.length - 1].id;
      batchIndex++;
    }

    // 5. Update index_meta after full run (Task 1.12)
    let finalDocCount = 0;
    let finalAvgDocLength = 0;

    if (!dryRun) {
      console.log(`Recalculating metadata index stats (Task 1.12)...`);
      const metaStartTime = Date.now();
      const finalStats = await recalculateMeta();
      finalDocCount = finalStats.doc_count;
      finalAvgDocLength = finalStats.avg_doc_length;
      const metaElapsed = Date.now() - metaStartTime;
      console.log(`Metadata updated: doc_count=${finalDocCount}, avg_doc_length=${finalAvgDocLength.toFixed(2)} (took ${metaElapsed}ms)`);
    } else {
      console.log(`[dry-run] Skipped metadata recalculation.`);
    }

    // 6. Print summary
    let newTermsAdded = 0;
    if (!dryRun) {
      const endTermCountRes = await query('SELECT COUNT(*)::int as count FROM terms');
      const endTermCount = endTermCountRes.rows[0].count;
      newTermsAdded = endTermCount - startTermCount;
    }

    const totalTime = Date.now() - overallStartTime;
    console.log(`\nIndexing complete!`);
    console.log(`Summary:`);
    console.log(`- Total docs indexed: ${totalIndexedDocs}`);
    console.log(`- New terms added: ${newTermsAdded}`);
    console.log(`- Time taken: ${totalTime}ms`);

  } catch (error) {
    console.error(`An error occurred during indexing:`, error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
