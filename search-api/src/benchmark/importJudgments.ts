import { query, closePool } from '../db/client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    const judgmentsPath = path.resolve(__dirname, '../../data/relevance_judgments.json');
    if (!fs.existsSync(judgmentsPath)) {
      console.error(`Relevance judgments file not found at ${judgmentsPath}`);
      return;
    }

    const judgments = JSON.parse(fs.readFileSync(judgmentsPath, 'utf8'));
    console.log(`Loaded ${judgments.length} relevance judgments to import.`);

    // Start a transaction
    await query('BEGIN');

    // Clear existing relevance judgments
    await query('DELETE FROM relevance_judgments');

    // Batch insert judgments
    // PostgreSQL parameters are limited, so we can insert in batches
    const batchSize = 1000;
    for (let i = 0; i < judgments.length; i += batchSize) {
      const batch = judgments.slice(i, i + batchSize);
      
      const valuesSql = [];
      const params = [];
      
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const offset = j * 3;
        valuesSql.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
        params.push(item.query, item.doc_id, item.relevance);
      }

      const sql = `
        INSERT INTO relevance_judgments (query, doc_id, relevance)
        VALUES ${valuesSql.join(', ')}
        ON CONFLICT (query, doc_id) DO UPDATE SET relevance = EXCLUDED.relevance
      `;
      
      await query(sql, params);
    }

    await query('COMMIT');
    console.log('Successfully imported all relevance judgments into relevance_judgments table.');

  } catch (err) {
    await query('ROLLBACK');
    console.error('Error importing relevance judgments:', err);
  } finally {
    await closePool();
  }
}

main();
