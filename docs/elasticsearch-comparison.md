# Elasticsearch Comparison & Evaluation Framework

> **Lightning Engine vs Elasticsearch** — A fair, reproducible, head-to-head benchmark built into the search engine UI.

---

## 1. Overview & Goals

This document describes the full implementation plan for:

1. **UI Compare Mode** — A dedicated comparison page triggered by a new "Compare" button on the homepage/results page, letting users run a query against both Lightning Engine and Elasticsearch side-by-side.
2. **Backend Elasticsearch Integration** — A new service adapter that proxies queries to a local Elasticsearch instance and returns results in a normalized format.
3. **Evaluation Framework** — A benchmark suite measuring latency, throughput, memory, index size, indexing speed, and ranking quality (Precision@K, Recall@K, MRR, NDCG) across both engines.
4. **Benchmark Methodology** — Warm-up runs, sequential (non-concurrent) execution, repeated measurements, standardized query sets, statistical analysis, and result storage.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Vite/React)              │
│                                                     │
│  Home.tsx        Results.tsx      Compare.tsx (NEW)  │
│  [Stats & Admin] [Stats]          [Split-pane UI]    │
│  [Compare ←NEW]                                      │
└────────────────────────┬────────────────────────────┘
                         │ HTTP
          ┌──────────────┴──────────────┐
          │       search-api (Express)   │
          │                             │
          │  /search  (existing)         │
          │  /es/search (NEW)            │◄── Elasticsearch Node
          │  /benchmark/run  (NEW)       │
          │  /benchmark/results  (NEW)   │
          └──────────────┬──────────────┘
                         │
          ┌──────────────┴──────────────┐
          │       PostgreSQL DB          │
          │  + benchmark_runs table      │
          │  + benchmark_results table   │
          └─────────────────────────────┘
```

---

## 3. UI Changes

### 3.1 "Compare" Button — `Home.tsx` & `Results.tsx`

**Location:** Top navigation bar, next to the existing `Stats & Admin` link.

**Behavior:**
- On `Home.tsx`, the nav bar currently has:  
  `[Stats & Admin]`  
  After change:  
  `[Stats & Admin]` `[Compare]`
- Clicking navigates to `/compare`

**Styling:** Same pill-button style as the Stats link, but with a distinct accent color (e.g., `hsl(var(--secondary))`).

---

### 3.2 Compare Page — `Compare.tsx` (NEW)

**Route:** `/compare`

**Layout:** A two-panel split view occupying the full viewport width.

```
┌────────────────────────────────────────────────────────┐
│       Lightning Engine  vs  Elasticsearch Compare      │
├──────────────────────────┬─────────────────────────────┤
│         [Search Bar]     │ (spans both panels)         │
│         [Search Button]  │ (no auto-suggest)           │
├──────────────────────────┬─────────────────────────────┤
│  Lightning Engine Panel  │  Elasticsearch Panel         │
│  ─────────────────────   │  ─────────────────────       │
│  Metrics Card:           │  Metrics Card:               │
│   • Avg Latency: 12ms    │   • Avg Latency: 45ms        │
│   • P50: 10ms            │   • P50: 38ms                │
│   • P95: 22ms            │   • P95: 80ms                │
│   • P99: 35ms            │   • P99: 110ms               │
│   • Precision@10: 0.78   │   • Precision@10: 0.82       │
│   • Recall@10: 0.71      │   • Recall@10: 0.68          │
│   • MRR: 0.65            │   • MRR: 0.70                │
│   • NDCG@10: 0.74        │   • NDCG@10: 0.77            │
│  ─────────────────────   │  ─────────────────────       │
│  Result 1                │  Result 1                    │
│  Result 2                │  Result 2                    │
│  ...                     │  ...                         │
└──────────────────────────┴─────────────────────────────┘
```

**Key UX Rules:**
- **No auto-suggest** in compare mode (fair match — eliminates suggestion-call latency bias)
- Timing starts only when user clicks the Search button
- Both engines fire their requests simultaneously (Promise.all) to keep wall-clock time equal
- After results load, the metrics card auto-scrolls into view

---

## 4. Backend Changes

### 4.1 Elasticsearch Adapter — `search-api/src/elasticsearch/`

**New files:**

#### `search-api/src/elasticsearch/client.ts`
```typescript
// Thin Elasticsearch client wrapper using @elastic/elasticsearch
import { Client } from '@elastic/elasticsearch';

export const esClient = new Client({
  node: process.env.ES_NODE || 'http://localhost:9200',
  auth: process.env.ES_USER
    ? { username: process.env.ES_USER, password: process.env.ES_PASSWORD || '' }
    : undefined
});
```

#### `search-api/src/elasticsearch/indexer.ts`
```typescript
// Bulk-indexes the same crawled_pages dataset that Lightning Engine uses
// Run once: npx tsx src/elasticsearch/indexer.ts
// Index name: lightning_pages
// Mapping: title (text, boost 3x), body (text), url (keyword), domain (keyword)
```

#### `search-api/src/elasticsearch/search.ts`
```typescript
// Executes a full-text query against lightning_pages index
// Returns results in the same SearchResult shape as /search
// Uses multi_match across title + body_text with BM25 (default ES similarity)
// Returns top 10 hits + took_ms from ES response._took
```

---

### 4.2 New API Endpoints in `search-api/src/index.ts`

#### `GET /es/search?q=<query>&page=<n>&limit=<n>`

- Proxies to Elasticsearch `lightning_pages` index
- Returns same JSON shape as `/search`:  
  `{ query, total_hits, page, results[], took_ms }`
- Records latency in the metrics system

#### `POST /benchmark/run`

- Body: `{ queries: string[], runs: number, warmup: number }`
- Sequentially executes each query `warmup` times (discarded), then `runs` times against both engines
- Stores raw timing data in `benchmark_results` table
- Returns `{ job_id, status: "started" }`

#### `GET /benchmark/results?job_id=<id>`

- Returns aggregated statistics for a completed benchmark job:
  - Per-engine: avg, median (P50), P95, P99 latency
  - QPS (queries per second)
  - Precision@10, Recall@10, MRR, NDCG@10 (when ground truth available)
  - Memory snapshot (taken via `process.memoryUsage()` + ES `/_nodes/stats`)
  - Index sizes

---

### 4.3 Database Schema Extensions

```sql
-- Stores each benchmark run session
CREATE TABLE benchmark_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  query_count INT NOT NULL,
  runs_per_query INT NOT NULL,
  warmup_runs INT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'running', -- running | completed | failed
  notes       TEXT
);

-- Stores per-query per-engine raw timing and result data
CREATE TABLE benchmark_results (
  id           BIGSERIAL PRIMARY KEY,
  run_id       UUID REFERENCES benchmark_runs(id),
  engine       TEXT NOT NULL,          -- 'lightning' | 'elasticsearch'
  query        TEXT NOT NULL,
  attempt      INT NOT NULL,           -- 1..runs
  latency_ms   NUMERIC NOT NULL,
  result_ids   TEXT[],                 -- ordered list of returned doc IDs
  total_hits   INT,
  is_warmup    BOOLEAN NOT NULL DEFAULT false
);

-- Optional: ground truth relevance judgments for NDCG/MRR computation
CREATE TABLE relevance_judgments (
  query        TEXT NOT NULL,
  doc_id       TEXT NOT NULL,
  relevance    INT NOT NULL,           -- 0 = not relevant, 1 = relevant, 2 = highly relevant
  PRIMARY KEY (query, doc_id)
);
```

---

## 5. Evaluation Framework

### 5.1 Metrics Catalogue

#### Latency Metrics (per engine, per query set)

| Metric | Formula | Description |
|--------|---------|-------------|
| **Avg Latency** | `mean(latencies)` | Arithmetic mean over all measurement runs |
| **P50 (Median)** | 50th percentile | Half of requests are faster than this |
| **P95** | 95th percentile | Tail-latency under typical load |
| **P99** | 99th percentile | Worst-case latency (outlier sensitivity) |
| **Std Dev** | `σ(latencies)` | Stability indicator |

#### Throughput

| Metric | Formula | Description |
|--------|---------|-------------|
| **QPS** | `total_queries / total_wall_time_seconds` | Queries per second (sequential mode) |

#### Storage & Indexing

| Metric | How Measured | Description |
|--------|-------------|-------------|
| **Index Size (Lightning)** | `pg_total_relation_size('inverted_index')` | PostgreSQL table size |
| **Index Size (ES)** | `GET /_cat/indices/lightning_pages?v` | ES index disk usage |
| **Indexing Speed** | `docs / elapsed_seconds` | Documents indexed per second |
| **Memory Usage (Lightning)** | `process.memoryUsage().heapUsed` at query time | Node.js heap |
| **Memory Usage (ES)** | `GET /_nodes/stats/jvm` → `heap_used_in_bytes` | JVM heap |

#### Ranking Quality (requires `relevance_judgments`)

| Metric | Formula | Description |
|--------|---------|-------------|
| **Precision@10** | `|relevant ∩ retrieved@10| / 10` | Fraction of top-10 that are relevant |
| **Recall@10** | `|relevant ∩ retrieved@10| / |total relevant|` | Coverage of relevant docs in top-10 |
| **MRR** | `mean(1 / rank_of_first_relevant)` | Mean Reciprocal Rank |
| **NDCG@10** | `DCG@10 / IDCG@10` | Normalized Discounted Cumulative Gain |

##### NDCG Detail
```
DCG@k  = Σᵢ₌₁ᵏ (2^relᵢ − 1) / log₂(i + 1)
IDCG@k = DCG of perfect ordering
NDCG@k = DCG@k / IDCG@k   ∈ [0, 1]
```

---

### 5.2 Standardized Query Set

The benchmark query set is stored in `search-api/data/benchmark_queries.json` and contains:

- **Tier 1 – Navigational** (10 queries): Exact page/domain lookups  
  e.g., `"openai research"`, `"wikipedia python"`
- **Tier 2 – Informational** (20 queries): Multi-term keyword queries  
  e.g., `"machine learning tutorials beginners"`, `"javascript async await promise"`
- **Tier 3 – Ambiguous** (10 queries): Short, polysemous terms  
  e.g., `"python"`, `"java"`, `"apple"`
- **Tier 4 – Long-tail** (10 queries): Rare / specific queries  
  e.g., `"positional inverted index proximity search implementation"`

**Total: 50 standardized queries**

```json
{
  "version": "1.0",
  "created": "2026-06-17",
  "queries": [
    { "id": "q001", "tier": "navigational", "text": "openai research" },
    { "id": "q002", "tier": "informational", "text": "machine learning tutorials beginners" }
  ]
}
```

---

### 5.3 Benchmark Execution Methodology

#### Anti-Bias Measures

| Risk | Mitigation |
|------|-----------|
| OS cache warming favoring second engine | Execute engines in alternating order per query |
| Concurrent resource contention | **Sequential execution only** — no concurrent requests |
| JIT/V8 optimization skewing early runs | **Warm-up phase**: 3 discarded runs per query before measurement |
| Single-run variance | **Minimum 10 repeated measurements** per query, per engine |
| Clock resolution | Use `performance.now()` (sub-millisecond) on Node.js side; ES `_took` field for ES |
| Network overhead | Both engines called via localhost — minimizes network jitter |
| Query order effects | Randomize query order for each benchmark job |

#### Execution Algorithm

```
For each query q in shuffle(benchmark_queries):
  For each engine e in alternating_order(['lightning', 'elasticsearch']):
    // Warm-up phase
    For i in 1..warmup_count:
      execute_query(engine=e, query=q, is_warmup=true)
    
    // Measurement phase
    For i in 1..runs_count:
      t_start = performance.now()
      result  = execute_query(engine=e, query=q)
      t_end   = performance.now()
      store_result(engine=e, query=q, latency=t_end-t_start, result_ids=result.ids)
```

#### Statistical Analysis (Post-Processing)

```typescript
function analyzeLatencies(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    avg:    samples.reduce((a, b) => a + b, 0) / samples.length,
    p50:    percentile(sorted, 50),
    p95:    percentile(sorted, 95),
    p99:    percentile(sorted, 99),
    stddev: stdDeviation(samples),
    min:    sorted[0],
    max:    sorted[sorted.length - 1],
    cv:     stdDeviation(samples) / mean(samples) // coefficient of variation
  };
}
```

---

## 6. File Structure — New Files

```
search engine/
├── docs/
│   └── elasticsearch-comparison.md   ← THIS FILE
│
├── search-api/
│   ├── data/
│   │   ├── benchmark_queries.json     [NEW] Standardized 50-query set
│   │   └── relevance_judgments.json   [NEW] Ground truth for ranking metrics
│   └── src/
│       ├── elasticsearch/
│       │   ├── client.ts              [NEW] ES client wrapper
│       │   ├── indexer.ts             [NEW] Bulk-index script (one-shot CLI)
│       │   └── search.ts              [NEW] ES search adapter
│       ├── benchmark/
│       │   ├── runner.ts              [NEW] Sequential benchmark execution engine
│       │   ├── metrics.ts             [NEW] Latency stats + ranking quality computations
│       │   └── storage.ts             [NEW] benchmark_runs / benchmark_results DB writes
│       └── index.ts                   [MODIFY] Add /es/search, /benchmark/run, /benchmark/results
│
├── frontend/
│   └── src/
│       ├── api/
│       │   └── client.ts              [MODIFY] Add esSearch(), runBenchmark(), getBenchmarkResults()
│       ├── pages/
│       │   └── Compare.tsx            [NEW] Split-pane compare UI with metrics cards
│       ├── components/
│       │   ├── MetricsCard.tsx        [NEW] Reusable metrics display card
│       │   └── ResultCard.tsx         [NEW] Shared result item used in both panels
│       └── App.tsx                    [MODIFY] Add /compare route
│
└── migrations/
    └── 004_benchmark_schema.sql       [NEW] benchmark tables + relevance_judgments
```

---

## 7. Implementation Phases

### Phase 1 — Infrastructure Setup *(~2 hours)*

1. Install Elasticsearch locally (Docker recommended):
   ```bash
   docker run -d --name es01 -p 9200:9200 \
     -e "discovery.type=single-node" \
     -e "xpack.security.enabled=false" \
     elasticsearch:8.13.0
   ```
2. Install `@elastic/elasticsearch` in `search-api`
3. Run migration `004_benchmark_schema.sql`
4. Write and run `elasticsearch/indexer.ts` to bulk-index `crawled_pages` into ES

### Phase 2 — Backend API *(~3 hours)*

1. Implement `elasticsearch/client.ts`, `elasticsearch/search.ts`
2. Add `GET /es/search` route to `search-api/src/index.ts`
3. Implement `benchmark/runner.ts`, `benchmark/metrics.ts`, `benchmark/storage.ts`
4. Add `POST /benchmark/run` and `GET /benchmark/results` routes
5. Create `data/benchmark_queries.json` (50 standard queries)

### Phase 3 — Frontend UI *(~4 hours)*

1. Add "Compare" button to `Home.tsx` and `Results.tsx` navbars
2. Add `/compare` route in `App.tsx`
3. Create `Compare.tsx` — split-pane, no auto-suggest, simultaneous dual-fetch
4. Create `MetricsCard.tsx` — animated metric display with delta comparisons
5. Create `ResultCard.tsx` — shared result component for both panels

### Phase 4 — Evaluation & Benchmark Dashboard *(~2 hours)*

1. Create `data/relevance_judgments.json` — manually assess top queries
2. Wire up NDCG/MRR calculations in `benchmark/metrics.ts`
3. Add benchmark run trigger to the Compare page ("Run Full Benchmark" button)
4. Display historical benchmark results (latest job summary)

### Phase 5 — Testing & Reproducibility *(~1 hour)*

1. Unit tests for metric calculations (NDCG edge cases, percentile computation)
2. Integration test for `/es/search` round-trip
3. Document reproducibility checklist

---

## 8. Elasticsearch Index Configuration

```json
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "similarity": {
      "default": { "type": "BM25", "k1": 1.5, "b": 0.75 }
    }
  },
  "mappings": {
    "properties": {
      "doc_id":       { "type": "keyword" },
      "url":          { "type": "keyword" },
      "domain":       { "type": "keyword" },
      "title":        { "type": "text", "boost": 3.0 },
      "body_text":    { "type": "text" },
      "description":  { "type": "text" },
      "crawled_at":   { "type": "date" },
      "word_count":   { "type": "integer" }
    }
  }
}
```

> **Fairness note:** Both engines use BM25 with identical `k1=1.5`, `b=0.75` to isolate implementation differences from parameter tuning.

---

## 9. Reproducibility & Fairness Guidelines

### Data Parity
- [ ] Both engines index the **exact same snapshot** of `crawled_pages`
- [ ] Snapshot frozen at benchmark start (no new crawls during benchmarking)
- [ ] Same document fields used for ranking input (title, body, URL)

### Parameter Parity
- [ ] BM25 `k1=1.5`, `b=0.75` for both engines
- [ ] Same result set size `k=10` for all ranking metrics
- [ ] No caching enabled on either side during cold-start benchmarks

### Execution Environment
- [ ] Benchmark runner is the **only process under load** during the run
- [ ] System resource monitoring active (CPU, RAM) throughout
- [ ] At least **3 independent benchmark jobs** run to verify consistency
- [ ] OS page cache cleared between cold-start vs. warm-cache runs

### Reporting
- [ ] Report **both cold-cache and warm-cache** numbers distinctly
- [ ] Always report full distribution (avg, P50, P95, P99, stddev), not just average
- [ ] Store raw result data for independent verification
- [ ] Version-stamp each benchmark run with engine commit hash and ES version

---

## 10. Visualization in Compare.tsx

### Metrics Card Design

Each engine panel displays a **MetricsCard** with:

```
┌─────────────────────────────────┐
│   Lightning Engine              │
│  ─────────────────────────────  │
│  Latency                        │
│  ├ Avg:  12.3 ms  ████░░░░░░   │
│  ├ P50:  10.1 ms  ███░░░░░░░   │
│  ├ P95:  22.4 ms  █████░░░░░   │
│  └ P99:  35.7 ms  ███████░░░   │
│                                 │
│  Ranking Quality                │
│  ├ Precision@10:  0.78  ▲+5%  │
│  ├ Recall@10:     0.71         │
│  ├ MRR:           0.65         │
│  └ NDCG@10:       0.74         │
│                                 │
│  Total Hits: 847                │
│  Query Time: 12ms               │
└─────────────────────────────────┘
```

- **Winner badge** shown on the faster engine (latency) and better engine (NDCG)
- **Delta indicators** (▲/▼) showing % difference vs. the other engine
- **Animated progress bars** for visual comparison

---

## 11. Open Questions

> [!IMPORTANT]
> **Q1: Elasticsearch Installation**  
> Will Elasticsearch be run via Docker or as a native install? Docker is recommended for portability. If Docker is unavailable, a Windows-native ES 8.x installer is needed.

> [!IMPORTANT]
> **Q2: Ground Truth Availability**  
> Ranking quality metrics (Precision@K, Recall@K, MRR, NDCG) require relevance judgments. Do you have existing labeled query-document pairs, or should we manually assess top results from the 50 standard queries to create `relevance_judgments.json`?

> [!NOTE]
> **Q3: Live vs. Aggregate Metrics in Compare Page**  
> Should the Compare page show metrics from only the single query just run (real-time, estimated from a single sample), or pull from benchmark job history table for aggregate stats across all 50 queries? Or both?

> [!NOTE]
> **Q4: Benchmark Trigger Location**  
> Should "Run Full Benchmark (50 queries)" live inside the Compare page, or be a separate Admin tool in the Stats & Admin dashboard?

> [!WARNING]
> **Q5: ES Authentication**  
> Elasticsearch 8.x ships with security enabled by default (TLS + auth). Plan assumes `xpack.security.enabled=false` for dev mode. Confirm if credentials via `.env` are needed instead.

---

## 12. Dependencies to Install

### search-api
```bash
npm install @elastic/elasticsearch
```

### No new frontend dependencies required
React, the native fetch API, and existing CSS variables are sufficient.

---

## 13. Verification Plan

### Automated Tests
```bash
# Unit tests for metrics module
cd search-api && npm test -- benchmark

# ES round-trip integration test (requires running ES instance)
npm test -- elasticsearch
```

### Manual Verification Steps
1. Start Elasticsearch: `docker start es01`
2. Run indexer: `npx tsx src/elasticsearch/indexer.ts`
3. Visit `/compare` in the browser
4. Type a query, click Search
5. Verify both panels load results within 5 seconds
6. Confirm metrics cards display all 8 metrics (avg, P50, P95, P99, Precision@10, Recall@10, MRR, NDCG@10)
7. Run `POST /benchmark/run` with 5 queries, 3 runs, 1 warmup
8. Check `GET /benchmark/results` returns complete aggregated statistics
9. Confirm delta indicators correctly identify the winner per metric category
