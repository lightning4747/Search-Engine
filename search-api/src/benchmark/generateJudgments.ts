import { query, closePool } from '../db/client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    const queriesPath = path.resolve(__dirname, '../../data/benchmark_queries.json');
    const queries = JSON.parse(fs.readFileSync(queriesPath, 'utf8'));

    // Fetch all active crawled pages
    const res = await query(
      'SELECT id, title, description, text_content FROM crawled_pages WHERE is_active = true AND indexed_at IS NOT NULL'
    );

    const docs = res.rows.map(r => ({
      id: String(r.id),
      title: (r.title || '').toLowerCase(),
      description: (r.description || '').toLowerCase(),
      content: (r.text_content || '').toLowerCase()
    }));

    console.log(`Loaded ${queries.length} queries and ${docs.length} documents.`);

    const judgments: any[] = [];

    for (const q of queries) {
      const qText = q.text.toLowerCase();
      const qTerms = qText.split(/\s+/).filter(Boolean);

      for (const doc of docs) {
        let rel = 0;

        // Rule 1: exact query matches title
        if (doc.title.includes(qText)) {
          rel = 2;
        }
        // Rule 2: all query terms present in title
        else if (qTerms.every(term => doc.title.includes(term))) {
          rel = 2;
        }
        // Rule 3: exact query matches description or content
        else if (doc.description.includes(qText) || doc.content.includes(qText)) {
          rel = 1;
        }
        // Rule 4: all query terms present in description or content
        else if (qTerms.every(term => doc.description.includes(term) || doc.content.includes(term))) {
          rel = 1;
        }

        if (rel > 0) {
          judgments.push({
            query: q.text,
            doc_id: doc.id,
            relevance: rel
          });
        }
      }
    }

    const judgmentsPath = path.resolve(__dirname, '../../data/relevance_judgments.json');
    fs.writeFileSync(judgmentsPath, JSON.stringify(judgments, null, 2), 'utf8');
    console.log(`Generated ${judgments.length} relevance judgments at ${judgmentsPath}`);

  } catch (err) {
    console.error('Error generating relevance judgments:', err);
  } finally {
    await closePool();
  }
}

main();
