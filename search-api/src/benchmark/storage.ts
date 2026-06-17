import { query } from '../db/client.js';

export interface BenchmarkRun {
  id: string;
  created_at: string;
  query_count: number;
  runs_per_query: number;
  warmup_runs: number;
  status: string;
  completed_at: string | null;
  notes: string | null;
}

export interface RawBenchmarkResult {
  id: string;
  run_id: string;
  engine: string;
  query: string;
  query_tier: string;
  attempt: number;
  latency_ms: number;
  result_ids: string[];
  total_hits: number;
  is_warmup: boolean;
}

export async function createBenchmarkRun(
  queryCount: number,
  runsPerQuery: number,
  warmupRuns: number,
  notes?: string
): Promise<string> {
  const sql = `
    INSERT INTO benchmark_runs (query_count, runs_per_query, warmup_runs, status, notes)
    VALUES ($1, $2, $3, 'running', $4)
    RETURNING id
  `;
  const res = await query(sql, [queryCount, runsPerQuery, warmupRuns, notes || null]);
  return res.rows[0].id;
}

export async function storeBenchmarkResult(
  runId: string,
  engine: string,
  queryText: string,
  tier: string,
  attempt: number,
  latencyMs: number,
  resultIds: string[],
  totalHits: number,
  isWarmup: boolean
): Promise<void> {
  const sql = `
    INSERT INTO benchmark_results (run_id, engine, query, query_tier, attempt, latency_ms, result_ids, total_hits, is_warmup)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;
  await query(sql, [runId, engine, queryText, tier, attempt, latencyMs, resultIds, totalHits, isWarmup]);
}

export async function completeBenchmarkRun(runId: string): Promise<void> {
  const sql = `
    UPDATE benchmark_runs
    SET status = 'completed', completed_at = now()
    WHERE id = $1
  `;
  await query(sql, [runId]);
}

export async function failBenchmarkRun(runId: string, error: string): Promise<void> {
  const sql = `
    UPDATE benchmark_runs
    SET status = 'failed', completed_at = now(), notes = COALESCE(notes || ' | Error: ', 'Error: ') || $2
    WHERE id = $1
  `;
  await query(sql, [runId, error]);
}

export async function getLatestBenchmarkRun(): Promise<BenchmarkRun | null> {
  const sql = `
    SELECT id, created_at, query_count, runs_per_query, warmup_runs, status, completed_at, notes
    FROM benchmark_runs
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const res = await query(sql);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    created_at: row.created_at.toISOString(),
    query_count: row.query_count,
    runs_per_query: row.runs_per_query,
    warmup_runs: row.warmup_runs,
    status: row.status,
    completed_at: row.completed_at ? row.completed_at.toISOString() : null,
    notes: row.notes
  };
}

export async function getBenchmarkRunById(runId: string): Promise<BenchmarkRun | null> {
  const sql = `
    SELECT id, created_at, query_count, runs_per_query, warmup_runs, status, completed_at, notes
    FROM benchmark_runs
    WHERE id = $1
  `;
  const res = await query(sql, [runId]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    created_at: row.created_at.toISOString(),
    query_count: row.query_count,
    runs_per_query: row.runs_per_query,
    warmup_runs: row.warmup_runs,
    status: row.status,
    completed_at: row.completed_at ? row.completed_at.toISOString() : null,
    notes: row.notes
  };
}

export async function getBenchmarkResults(runId: string): Promise<RawBenchmarkResult[]> {
  const sql = `
    SELECT id, run_id, engine, query, query_tier, attempt, latency_ms, result_ids, total_hits, is_warmup
    FROM benchmark_results
    WHERE run_id = $1 AND is_warmup = false
    ORDER BY id ASC
  `;
  const res = await query(sql, [runId]);
  return res.rows.map(row => ({
    id: String(row.id),
    run_id: row.run_id,
    engine: row.engine,
    query: row.query,
    query_tier: row.query_tier,
    attempt: row.attempt,
    latency_ms: Number(row.latency_ms),
    result_ids: row.result_ids || [],
    total_hits: row.total_hits,
    is_warmup: row.is_warmup
  }));
}
