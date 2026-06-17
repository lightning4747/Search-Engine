import { esClient } from './client.js';

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

export async function esSearch(q: string, page: number, limit: number): Promise<SearchResponse> {
  const from = (page - 1) * limit;
  const size = limit;

  const response = await esClient.search({
    index: 'lightning_pages',
    from,
    size,
    query: {
      multi_match: {
        query: q,
        fields: ['title^3', 'description^1.5', 'body_text'],
        type: 'best_fields'
      }
    }
  });

  const hits = response.hits.hits;
  const total = typeof response.hits.total === 'number'
    ? response.hits.total
    : (response.hits.total as any)?.value || 0;

  const results: SearchResult[] = hits.map((hit: any) => {
    const source = hit._source || {};
    return {
      id: String(source.doc_id || hit._id),
      url: source.url || '',
      title: source.title || '',
      snippet: source.body_text ? source.body_text.substring(0, 200) : '',
      score: hit._score || 0,
      domain: source.domain || '',
      crawled_at: source.crawled_at || ''
    };
  });

  return {
    query: q,
    total_hits: total,
    page,
    results,
    took_ms: response.took
  };
}
