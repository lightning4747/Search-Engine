import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load .env
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../web-crawler/.env'),
  path.resolve(process.cwd(), 'web-crawler/.env'),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  bm25: {
    k1: parseFloat(process.env.BM25_K1 || '1.5'),
    b: parseFloat(process.env.BM25_B || '0.75')
  },
  boosts: {
    title: parseFloat(process.env.BOOST_TITLE || '3.0'),
    heading: parseFloat(process.env.BOOST_HEADING || '1.8'),
    body: parseFloat(process.env.BOOST_BODY || '1.0')
  },
  authority: {
    alpha: parseFloat(process.env.AUTHORITY_ALPHA || '0.2')
  },
  recencyMultiplier: parseFloat(process.env.RECENCY_BOOST_MULTIPLIER || '1.1'),
  xAdminKey: process.env.X_ADMIN_KEY || 'default_admin_key'
};
export type Config = typeof config;
