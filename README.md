# Search Engine

A lightweight search engine with positional indexing, real-time query parsing (must-terms, exact phrases, proximity matching, exclusions), spell-checking, synonym expansion, and authority-based ranking (PageRank).

This search engine is designed to run on top of crawled page databases [Web Crawler Repository](https://github.com/lightning4747/Web-crawler).

## Key Features
* **Positional Indexing**: Custom tokenizer, normalizer, Porter stemmer, and delta-encoded (VByte compressed) postings that track term coordinates.
* **Complex Queries**: Full support for quoted exact phrases (`"search engine"`), proximity bounds (`"search engine" ~5`), exclusion prefixes (`-javascript`), and normal AND keyword retrieval.
* **PageRank Authority**: Adjacency link graph calculator using Min-Max normalized iterative PageRank to boost search relevance.
* **Quality & Deduplication**: Document filtering based on SimHash Hamming-distance near-duplicate detection and word count filters.
* **Query Intelligence**: Edit-distance spell correction (Damerau-Levenshtein) and static synonym mapping.
* **Elegant Frontend UI**: A premium dark-mode dashboard showcasing term counts, database size, and responsive results.

---

## Directory Structure
* `indexer/` - Document ingestion CLI, postings writer, and compression utilities.
* `search-api/` - HTTP query API server, prefix trie completion, and ranking engine.
* `frontend/` - React, TypeScript, and Vite single-page dashboard.
* `web-crawler/` - Scraper database seeds and source URLs.
* `docs/` - Technical specifications, DDL schemas, and operational guides.

---

## Getting Started

### 1. Database Setup
Ensure PostgreSQL is running locally and set up the `web_crawler` database:
```bash
createdb web_crawler
```
Configure environment variables in `web-crawler/.env` (which is shared/read by the search modules):
```env
DATABASE_URL=postgresql://postgres:<your_password>@localhost:5432/web_crawler
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=<your_password>
PGDATABASE=web_crawler
```

Apply the database schema:
```bash
psql -d web_crawler -f docs/schema.sql
```

### 2. Running the Indexer
Install dependencies and run the positional indexer:
```bash
cd indexer
npm install

# Run the full indexer
npx tsx src/index.ts --reindex-all
```
Available flags:
* `--reindex-all`: Resets index tables and reprocesses all active documents.
* `--batch-size <n>`: Processes `<n>` pages per database transaction.
* `--dry-run`: Simulates text processing without database writes.

### 3. Running the Search API
Install dependencies and start the API server:
```bash
cd ../search-api
npm install
npm run dev
```
The API server starts on port `3000`.

### 4. Running the Frontend
Start the React application:
```bash
cd ../frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Running Tests
Run Vitest tests in the respective project folders:
```bash
cd indexer && npm test
cd ../search-api && npm test
```

For detailed specifications and user guides, refer to the [Documentation](./docs/) directory.
