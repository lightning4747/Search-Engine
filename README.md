# Search Engine

A lightweight search engine with positional indexing, real-time query parsing (must-terms, exact phrases, proximity matching, exclusions), spell-checking, synonym expansion, and authority-based ranking (PageRank). Includes a side-by-side comparison against Elasticsearch on the same document corpus, with a full benchmark suite for evaluating latency, throughput, and retrieval accuracy.

This search engine is designed to run on top of crawled page databases from the [Web Crawler Repository](https://github.com/lightning4747/Web-crawler).

## Key Features

* **Positional Indexing**: Custom tokenizer, normalizer, Porter stemmer, and delta-encoded (VByte compressed) postings that track term coordinates.
* **Complex Queries**: Full support for quoted exact phrases (`"search engine"`), proximity bounds (`"search engine" ~5`), exclusion prefixes (`-javascript`), and standard AND keyword retrieval.
* **PageRank Authority**: Adjacency link graph calculator using Min-Max normalized iterative PageRank to boost search relevance.
* **Quality & Deduplication**: Document filtering based on SimHash Hamming-distance near-duplicate detection and word count filters.
* **Query Intelligence**: Edit-distance spell correction (Damerau-Levenshtein) and static synonym mapping.
* **Engine Comparison**: Side-by-side live search against Elasticsearch on the same 499-document corpus, with per-query metrics and a dedicated Compare page.
* **Benchmark Runner**: Admin-controlled benchmark tool running 50 standardized queries (10 runs each, 3 warm-up) across both engines. Reports latency percentiles (P50, P95, P99), QPS, NDCG@10, MRR, Precision@10, and Recall@10.

---

## Directory Structure

* `indexer/` - Document ingestion CLI, postings writer, and compression utilities.
* `search-api/` - HTTP query API server, prefix trie completion, ranking engine, Elasticsearch proxy, and benchmark runner.
* `frontend/` - React, TypeScript, and Vite single-page dashboard.
* `web-crawler/` - Scraper database seeds and source URLs.
* `docs/` - Technical specifications, DDL schemas, and operational guides.
* `spec/` - Implementation plans and task tracking for major features.

---

## Getting Started

### 1. Database Setup

Ensure PostgreSQL is running locally and set up the `web_crawler` database:

```bash
createdb web_crawler
```

Configure environment variables in `web-crawler/.env` (shared across all modules):

```env
DATABASE_URL=postgresql://postgres:<your_password>@localhost:5432/web_crawler
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=<your_password>
PGDATABASE=web_crawler
```

Apply the base schema and benchmark schema migrations:

```bash
psql -d web_crawler -f docs/schema.sql
psql -d web_crawler -f spec/migrations/004_benchmark_schema.sql
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

### 3. Elasticsearch Setup

The comparison feature requires a local Elasticsearch instance. The simplest way to run one is via Docker:

```bash
docker run -d --name es01 \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
  elasticsearch:8.13.0
```

Once Elasticsearch is healthy at `http://localhost:9200`, bulk-index the corpus from the search API directory:

```bash
cd search-api
npx tsx src/elasticsearch/indexer.ts
```

This indexes the same 499 documents from `crawled_pages` into the `lightning_pages` index using BM25 with `k1=1.5, b=0.75` — matching the custom engine's configuration exactly.

### 4. Running the Search API

Install dependencies and start the API server:

```bash
cd search-api
npm install
npm run dev
```

The API server starts on port `3000`. It exposes the standard search routes plus:

* `GET /es/search?q=<query>` — proxies the query to Elasticsearch and returns normalized results.
* `POST /benchmark/run` — triggers a full 50-query benchmark job (requires `x-admin-key` header).
* `GET /benchmark/results` — returns aggregated stats from the latest completed benchmark job.

### 5. Running the Frontend

Start the React application:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Engine Comparison

The Compare page (`/compare`) runs a single query against both the custom engine and Elasticsearch simultaneously and shows results side-by-side. Per-query metrics displayed include:

| Metric | Description |
|--------|-------------|
| Query Time (ms) | Wall-clock from request to response, measured client-side |
| Total Hits | Number of documents matched by each engine |
| Results Shown | Top-10 results returned |
| NDCG@10 | Normalized Discounted Cumulative Gain at rank 10 |
| MRR | Mean Reciprocal Rank |
| Precision@10 | Fraction of top-10 results that are relevant |
| Recall@10 | Fraction of all relevant documents found in top 10 |

Relevance judgments used for accuracy metrics are sourced from the `relevance_judgments` table. When no pre-assessed judgments exist for a query, the system falls back to a text-matching heuristic against the document corpus, so accuracy metrics are always available regardless of the query.

---

## Benchmark Runner

The benchmark runner is accessible from the Stats & Admin dashboard. It runs 50 standardized queries across four tiers (navigational, informational, ambiguous, long-tail), with 3 warm-up runs discarded and 10 measured runs per query per engine. Engines are queried in alternating order per query to avoid cache bias.

Reported aggregate metrics:

| Metric | Description |
|--------|-------------|
| Avg Latency | Mean query latency across all non-warmup runs |
| P50 / P95 / P99 | Latency percentiles |
| QPS | Sequential throughput over the full job |
| Precision@10 | Average fraction of relevant results in top 10 |
| Recall@10 | Average fraction of relevant documents retrieved |
| MRR | Mean Reciprocal Rank across all queries |
| NDCG@10 | Mean Normalized Discounted Cumulative Gain |

Triggering the runner requires the `x-admin-key` request header.

---

## Running Tests

Run Vitest tests in the respective project folders:

```bash
cd indexer && npm test
cd ../search-api && npm test
```

Tests cover the metrics calculation module (NDCG, MRR, Precision, Recall) and core indexer utilities.

For detailed specifications and user guides, refer to the [Documentation](./docs/) directory.

## Note
In some cases, my search engine may be faster than Elasticsearch, but that does not necessarily mean it is superior. One reason is that my engine may be able to access data directly from memory more efficiently, while Elasticsearch could experience additional overhead, especially when running in a Docker container. To ensure a fair comparison, benchmarks should be performed using new or unseen queries rather than repeated ones that may benefit from caching.

Another important factor is search quality. While latency is easy to measure, relevance and accuracy are often more important in real-world search systems. Currently, there is a significant gap in result quality between my search engine and Elasticsearch, which is something that must be considered alongside performance when evaluating the two systems.