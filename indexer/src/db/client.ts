import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Look for .env in current directory, web-crawler directory, or parent directory
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../web-crawler/.env'),
  path.resolve(process.cwd(), 'web-crawler/.env'),
  path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../web-crawler/.env'),
];

for (const envPath of envPaths) {
  // Normalize windows path
  let cleanPath = envPath;
  if (cleanPath.startsWith('/') && process.platform === 'win32') {
    cleanPath = cleanPath.slice(1);
  }
  if (fs.existsSync(cleanPath)) {
    dotenv.config({ path: cleanPath });
    break;
  }
}

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({ connectionString })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      database: process.env.PGDATABASE || 'web_crawler',
    });

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export async function closePool() {
  await pool.end();
}
