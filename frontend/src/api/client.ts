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
  }
};
