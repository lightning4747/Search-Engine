export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (p <= 0) return sorted[0];
  if (p >= 100) return sorted[sorted.length - 1];

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export interface LatencyStats {
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  stddev: number;
  min: number;
  max: number;
  cv: number;
}

export function analyzeLatencies(samples: number[]): LatencyStats {
  if (samples.length === 0) {
    return { avg: 0, p50: 0, p95: 0, p99: 0, stddev: 0, min: 0, max: 0, cv: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;

  const variance = sorted.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / sorted.length;
  const stddev = Math.sqrt(variance);
  const cv = avg !== 0 ? stddev / avg : 0;

  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);

  return {
    avg: Number(avg.toFixed(3)),
    p50: Number(p50.toFixed(3)),
    p95: Number(p95.toFixed(3)),
    p99: Number(p99.toFixed(3)),
    stddev: Number(stddev.toFixed(3)),
    min: Number(min.toFixed(3)),
    max: Number(max.toFixed(3)),
    cv: Number(cv.toFixed(3))
  };
}

export function computePrecisionAtK(retrievedIds: string[], relevantIds: Set<string>, k: number): number {
  if (k <= 0) return 0;
  const list = retrievedIds.slice(0, k);
  let relevantCount = 0;
  for (const id of list) {
    if (relevantIds.has(id)) {
      relevantCount++;
    }
  }
  return relevantCount / k;
}

export function computeRecallAtK(retrievedIds: string[], relevantIds: Set<string>, k: number): number {
  if (relevantIds.size === 0) return 0;
  const list = retrievedIds.slice(0, k);
  let relevantCount = 0;
  for (const id of list) {
    if (relevantIds.has(id)) {
      relevantCount++;
    }
  }
  return relevantCount / relevantIds.size;
}

export function computeMRR(
  results: { query: string; retrievedIds: string[] }[],
  judgments: Map<string, Map<string, number>>
): number {
  if (results.length === 0) return 0;

  let sumReciprocalRank = 0;

  for (const res of results) {
    const queryJudgments = judgments.get(res.query);
    if (!queryJudgments) continue;

    let foundRank = 0;
    for (let i = 0; i < res.retrievedIds.length; i++) {
      const docId = res.retrievedIds[i];
      const rel = queryJudgments.get(docId) || 0;
      if (rel > 0) {
        foundRank = i + 1;
        break;
      }
    }

    if (foundRank > 0) {
      sumReciprocalRank += 1 / foundRank;
    }
  }

  return sumReciprocalRank / results.length;
}

export function computeNDCG(retrievedIds: string[], judgments: Map<string, number>, k: number): number {
  if (k <= 0 || retrievedIds.length === 0) return 0;

  const limit = Math.min(retrievedIds.length, k);
  let dcg = 0;

  for (let i = 0; i < limit; i++) {
    const docId = retrievedIds[i];
    const rel = judgments.get(docId) || 0;
    const numerator = Math.pow(2, rel) - 1;
    const denominator = Math.log2(i + 2);
    dcg += numerator / denominator;
  }

  const allJudgments = Array.from(judgments.entries())
    .map(([_, rel]) => rel)
    .filter(rel => rel > 0)
    .sort((a, b) => b - a);

  if (allJudgments.length === 0) {
    return 0;
  }

  const idcgLimit = Math.min(allJudgments.length, k);
  let idcg = 0;
  for (let i = 0; i < idcgLimit; i++) {
    const rel = allJudgments[i];
    const numerator = Math.pow(2, rel) - 1;
    const denominator = Math.log2(i + 2);
    idcg += numerator / denominator;
  }

  if (idcg === 0) return 0;
  return dcg / idcg;
}
