# Operations Guide & Tuning Parameters

This guide details command line procedures, index maintenance tasks, and configuration options.

## 1. Running Index & Maintenance Scripts

All commands are run from the `indexer` folder.

### Run Incremental Indexer
Process newly crawled documents without resetting existing index tables:
```bash
npx tsx src/index.ts
```

### Full Index Rebuild
Clear the terms and postings tables completely, reset all crawled pages, and rebuild:
```bash
npx tsx src/index.ts --reindex-all
```

### Run PageRank Calculator
Calculate and save normalized authority scores based on links:
```bash
npm run compute-pagerank
```

### Run Position Compression Migration
Migrate old integer positions arrays to compressed binary format:
```bash
npm run migrate-positions
```

### Run Index Compaction (Daily Cron)
Promote recent documents to cold storage segments and clean up stale postings:
```bash
npm run compact
```

---

## 2. Tuning Search Relevance Parameters

Search ranking behavior can be configured without code changes by editing environment variables inside `web-crawler/.env` (which is shared by all services).

### BM25 Parameters
* `BM25_K1` (default: `1.5`): Controls term frequency saturation. Higher values increase the importance of multiple matches.
* `BM25_B` (default: `0.75`): Adjusts document length penalty. Higher values penalize long documents more heavily.

### Field Weight Boosts
* `BOOST_TITLE` (default: `3.0`): Multiplier for term matches in the document `<title>`.
* `BOOST_HEADING` (default: `1.8`): Multiplier for matches in `<h1>`, `<h2>`, etc.
* `BOOST_BODY` (default: `1.0`): Multiplier for matches in body text.

### Authority & Recency Weights
* `AUTHORITY_ALPHA` (default: `0.2`): The relative weight of PageRank scores on final score.
* `RECENCY_BOOST_MULTIPLIER` (default: `1.1`): Boost multiplier for pages in the hot segment (crawled in last 30 days).
* `SYNONYM_BOOST_MULTIPLIER` (default: `0.5`): Discount factor for synonym matches.
