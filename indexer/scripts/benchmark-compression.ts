import { pool } from '../src/db/client.js';
import { compressPositions } from '../src/compression/positionCompress.js';

async function benchmark() {
  console.log('Running compression benchmark on positions arrays...');
  const client = await pool.connect();
  try {
    const limit = 10000;
    // We select up to 10k postings rows
    const res = await client.query(
      `SELECT positions FROM postings LIMIT $1`,
      [limit]
    );

    console.log(`Fetched ${res.rows.length} postings rows for benchmarking.`);
    if (res.rows.length === 0) {
      console.log('No postings found to benchmark. Run the indexer or crawler first.');
      return;
    }

    let totalOriginalIntegers = 0;
    let totalUncompressedBytes = 0;
    let totalCompressedBytes = 0;

    for (const row of res.rows) {
      // In PG, positions was stored as INT[] or now as BYTEA.
      // Wait, since we migrated the column to BYTEA, the row.positions returned is a Buffer.
      // So we can decompress it first to know the original array, or just use the database values.
      // To be safe, we can import decompressPositions, decompress it, then re-compress it!
      // This is extremely safe and accurate.
      const buffer = row.positions as Buffer;
      
      // Let's import decompress positions
      const { decompressPositions } = await import('../src/compression/positionCompress.js');
      const positions = decompressPositions(buffer);

      const uncompressedBytes = positions.length * 4; // 4 bytes per 32-bit integer
      const compressedBuffer = compressPositions(positions);
      const compressedBytes = compressedBuffer.length;

      totalOriginalIntegers += positions.length;
      totalUncompressedBytes += uncompressedBytes;
      totalCompressedBytes += compressedBytes;
    }

    const savingsBytes = totalUncompressedBytes - totalCompressedBytes;
    const savingsPercent = totalUncompressedBytes > 0 
      ? (savingsBytes / totalUncompressedBytes) * 100 
      : 0;

    console.log('\n--- Benchmark Results ---');
    console.log(`Total postings arrays benchmarked: ${res.rows.length}`);
    console.log(`Total positions (integers) processed: ${totalOriginalIntegers}`);
    console.log(`Total uncompressed size (4 bytes/int): ${totalUncompressedBytes.toLocaleString()} bytes`);
    console.log(`Total VByte compressed size:           ${totalCompressedBytes.toLocaleString()} bytes`);
    console.log(`Space saved:                           ${savingsBytes.toLocaleString()} bytes (${savingsPercent.toFixed(2)}% reduction)`);
    console.log('-------------------------');

  } catch (err) {
    console.error('Benchmark failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

benchmark();
