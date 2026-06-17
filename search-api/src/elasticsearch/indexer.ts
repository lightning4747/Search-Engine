import { esClient } from './client.js';
import { query, closePool } from '../db/client.js';
import { performance } from 'perf_hooks';

async function index() {
  const startTime = performance.now();
  console.log('Starting indexer script...');

  try {
    // 1. Delete index if exists
    try {
      await esClient.indices.delete({ index: 'lightning_pages' });
      console.log('Deleted existing index lightning_pages');
    } catch (e: any) {
      if (e.meta?.statusCode !== 404) {
        throw e;
      }
      console.log('Index lightning_pages does not exist. Creating new...');
    }

    // 2. Create index with settings & mapping
    await esClient.indices.create({
      index: 'lightning_pages',
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        similarity: {
          default: {
            type: 'BM25',
            k1: 1.5,
            b: 0.75
          }
        }
      },
      mappings: {
        properties: {
          doc_id:       { type: 'keyword' },
          url:          { type: 'keyword' },
          domain:       { type: 'keyword' },
          title:        { type: 'text' },
          body_text:    { type: 'text' },
          description:  { type: 'text' },
          crawled_at:   { type: 'date' },
          word_count:   { type: 'integer' }
        }
      }
    });
    console.log('Created index lightning_pages with similarity settings & mapping');

    // 3. Fetch active pages from DB
    const res = await query(`
      SELECT cp.id as doc_id, u.url, cp.title, cp.text_content as body_text, cp.description, u.domain, cp.crawled_at, cp.word_count
      FROM crawled_pages cp
      JOIN urls u ON cp.url_id = u.id
      WHERE cp.is_active = true AND cp.indexed_at IS NOT NULL
    `);

    const documents = res.rows.map(row => ({
      doc_id: String(row.doc_id),
      url: row.url,
      domain: row.domain,
      title: row.title || '',
      body_text: row.body_text || '',
      description: row.description || '',
      crawled_at: row.crawled_at ? new Date(row.crawled_at).toISOString() : null,
      word_count: row.word_count ? Number(row.word_count) : 0
    }));

    console.log(`Fetched ${documents.length} pages from database.`);

    // 4. Bulk index in batches of 100
    const batchSize = 100;
    let indexedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const operations = [];

      for (const doc of batch) {
        operations.push({ index: { _index: 'lightning_pages', _id: doc.doc_id } });
        operations.push(doc);
      }

      const bulkResponse = await esClient.bulk({ refresh: true, operations });

      if (bulkResponse.errors) {
        for (const item of bulkResponse.items) {
          const action = Object.keys(item)[0];
          const operation = (item as any)[action];
          if (operation.error) {
            failedCount++;
            console.error(`Failed to index doc ${operation._id}:`, operation.error);
          } else {
            indexedCount++;
          }
        }
      } else {
        indexedCount += batch.length;
      }
    }

    const elapsed = (performance.now() - startTime).toFixed(2);
    console.log(`Indexing completed in ${elapsed}ms. Success: ${indexedCount}, Failed: ${failedCount}`);

  } catch (err) {
    console.error('Indexer encountered an error:', err);
  } finally {
    await closePool();
    console.log('Database connection pool closed.');
  }
}

index();
