export interface SearchResult {
  id: string;
  url: string;
  title: string;
  snippet: string;
  score: number;
  domain: string;
  crawled_at: string;
}

export interface SearchResponse {
  query: string;
  total_hits: number;
  page: number;
  results: SearchResult[];
  took_ms: number;
  precision_at_10?: number | null;
  recall_at_10?: number | null;
  ndcg_at_10?: number | null;
}

export interface StatsResponse {
  doc_count: number;
  avg_doc_length: number;
  last_indexed_at: string | null;
  total_terms: number;
}

export interface DocResponse {
  id: string;
  url: string;
  title: string;
  description: string | null;
  domain: string;
  crawled_at: string | null;
  indexed_at: string | null;
  word_count: number | null;
  doc_length: number | null;
}

export interface EsSearchResponse extends SearchResponse {}

export interface EngineStats {
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  qps: number;
  precision_at_10: number;
  recall_at_10: number;
  mrr: number;
  ndcg_at_10: number;
}

export interface BenchmarkJobResult {
  job_id: string;
  status: 'running' | 'completed' | 'failed';
  created_at: string;
  notes?: string | null;
  message?: string;
  lightning?: EngineStats;
  elasticsearch?: EngineStats;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errMsg = `Request failed with status ${res.status}`;
    try {
      const json = await res.json();
      if (json.error) {
        errMsg = json.error;
      }
    } catch {
      // ignore
    }
    throw new ApiError(res.status, errMsg);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  async search(q: string, page = 1, limit = 10): Promise<SearchResponse> {
    const params = new URLSearchParams({
      q,
      page: String(page),
      limit: String(limit)
    });
    return request<SearchResponse>(`/search?${params.toString()}`);
  },

  async suggest(q: string): Promise<string[]> {
    const params = new URLSearchParams({ q });
    const res = await request<{ suggestions: string[] }>(`/suggest?${params.toString()}`);
    return res.suggestions;
  },

  async getDocument(id: string): Promise<DocResponse> {
    return request<DocResponse>(`/document/${id}`);
  },

  async getStats(): Promise<StatsResponse> {
    return request<StatsResponse>('/stats');
  },

  async triggerReindex(adminKey: string): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>('/admin/reindex', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey
      }
    });
  },

  async esSearch(q: string, page = 1, limit = 10): Promise<EsSearchResponse> {
    const params = new URLSearchParams({
      q,
      page: String(page),
      limit: String(limit)
    });
    return request<EsSearchResponse>(`/es/search?${params.toString()}`);
  },

  async runBenchmark(): Promise<{ job_id: string; status: string; message: string }> {
    return request<{ job_id: string; status: string; message: string }>('/benchmark/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },

  async getBenchmarkResults(jobId?: string): Promise<BenchmarkJobResult> {
    const url = jobId ? `/benchmark/results?job_id=${jobId}` : '/benchmark/results';
    return request<BenchmarkJobResult>(url);
  }
};
