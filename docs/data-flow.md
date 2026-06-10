# Data Flow & Life of a Query

This document tracks how raw crawled pages are processed, indexed, and eventually queried by users.

## 1. Data Flow Pipeline

```
[Web Crawler]
      │
      ▼
(crawled_pages table)
      │
      ▼
[Indexer CLI]  ──(Deduplication & Word Filter)──► [Skip Indexing]
      │
      ▼ (Tokenize, Stem, Delta Compress)
(postings & terms tables)
      │
      ▼
[Search API]  ◄──(BM25, PageRank Boost, Segment Weights)──► [Frontend Dashboard]
```

---

## 2. Walkthrough Example

### Ingestion & Indexing Phase
Let's trace the life of a single web page:
1. **Crawling**: The web crawler saves a page to `crawled_pages`:
   * **URL**: `https://vite.dev`
   * **Title**: `Vite Build Tool`
   * **Body**: `Vite is a fast build tool for modern web projects.`
2. **Indexer Loading**: The indexer loads pages where `indexed_at` is `NULL`.
3. **Duplicate Detection**: The page text is fingerprinted. It matches no existing fingerprints (Hamming distance > 3), so it is accepted.
4. **Tokenization & Normalization**:
   * Text is split into words: `['vite', 'build', 'tool', 'fast', 'modern', 'web', 'projects']` (after stopword filtering).
5. **Stemming**:
   * Porter stemmer stems words: `['vite', 'build', 'tool', 'fast', 'modern', 'web', 'project']` (e.g. `"projects"` stems to `"project"`).
6. **Compression**:
   * Term position deltas are calculated and VByte compressed.
7. **Database Persistence**:
   * Stored in `postings` and `terms` tables. Page is marked `indexed_at = NOW()`.

---

### Query Phase
Let's trace a user query for `"vite tool"`:
1. **Input**: User searches for `"vite tool"` on the frontend home page.
2. **API Endpoint Call**: Frontend requests `/search?q=vite+tool`.
3. **Query Parsing**: The API parser creates a plan:
   ```json
   { "must": ["vite", "tool"], "phrase": [], "proximity": [], "exclude": [] }
   ```
4. **Vocabulary Mapping**: The terms are mapped to `term_id`s in the `terms` table.
5. **Postings Retrieval**: Postings matching the terms are fetched from the database, and delta-encoded coordinates are decompressed in memory.
6. **Ranking & Boosts**:
   * Calculate Okapi BM25 score for the terms.
   * Add a `3.0` multiplier boost if `vite` or `tool` matched in the document title.
   * Add PageRank authority boost: `bm25Score * (1 + 0.2 * authorityScore)`.
7. **Snippet Generation**: Extract body text, locate the highest-density window of matches, and highlight the hits (`<mark>Vite</mark> is a fast build <mark>tool</mark>...`).
8. **Render**: Frontend displays the paginated cards to the user.
9. **Instant Autocomplete**: If a user types `vi`, the frontend debounces a request to `/suggest?q=vi`, which queries the prefix trie in-memory and returns `["vite", "vitest"]`.
