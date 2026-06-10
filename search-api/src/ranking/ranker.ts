import { scoreFieldWeighted, FieldBoosts, DEFAULT_FIELD_BOOSTS } from './fieldBoost.js';

export interface PostingRow {
  term: string;
  doc_id: number;
  tf_title: number;
  tf_heading: number;
  tf_body: number;
  positions: number[];
  df: number; // Document frequency of the term in the corpus
}

export interface IndexMeta {
  doc_count: number; // Total number of documents (N)
  avg_doc_length: number; // Average document length (avgdl)
}

export interface RetrievalPlan {
  must: string[];
  exclude: string[];
  phrase?: any[];
  proximity?: any[];
}

export interface RankedResult {
  doc_id: number;
  score: number;
}

/**
 * Ranks candidate documents based on the retrieval plan and postings rows.
 * Computes combined field-weighted BM25 scores across all query terms.
 * Excludes documents containing any excluded terms.
 * 
 * @param plan The parsed RetrievalPlan
 * @param postings Postings rows fetched from the database for the query terms
 * @param indexMeta Corpus-level metadata (doc_count, avg_doc_length)
 * @param docLengths Map of doc_id to its document length (body text length)
 * @param boosts Configurable field boosts
 * @param k1 Tuning parameter k1 for BM25
 * @param b Tuning parameter b for BM25
 * @returns Sorted array of RankedResult objects in descending order of score
 */
export function rankDocuments(
  plan: RetrievalPlan,
  postings: PostingRow[],
  indexMeta: IndexMeta,
  docLengths: Map<number, number>,
  boosts: FieldBoosts = DEFAULT_FIELD_BOOSTS,
  k1?: number,
  b?: number,
  authorityScores?: Map<number, number>,
  alpha: number = 0.2
): RankedResult[] {
  const { doc_count: N, avg_doc_length: avgdl } = indexMeta;


  // 1. Find all doc_ids that contain any excluded terms to filter them out
  const excludedDocIds = new Set<number>();
  const excludeTerms = new Set(plan.exclude.map(t => t.toLowerCase()));
  
  for (const p of postings) {
    if (excludeTerms.has(p.term.toLowerCase())) {
      excludedDocIds.add(p.doc_id);
    }
  }

  // 2. Aggregate scores per document for terms in the 'must' list (or general query terms)
  // We only score terms that are in the plan.must list
  const mustTerms = new Set(plan.must.map(t => t.toLowerCase()));
  const docScores = new Map<number, number>();

  for (const p of postings) {
    // Skip if the document contains any excluded term
    if (excludedDocIds.has(p.doc_id)) {
      continue;
    }

    // Only score terms that are part of the 'must' retrieval plan
    if (!mustTerms.has(p.term.toLowerCase())) {
      continue;
    }

    const docLen = docLengths.get(p.doc_id) || 0;

    const termScore = scoreFieldWeighted(
      p.tf_title,
      p.tf_heading,
      p.tf_body,
      p.df,
      N,
      avgdl,
      docLen,
      boosts,
      k1,
      b
    );

    const currentScore = docScores.get(p.doc_id) || 0;
    docScores.set(p.doc_id, currentScore + termScore);
  }

  // 3. Convert to RankedResult array, sort descending by score
  const results: RankedResult[] = [];
  for (const [docId, score] of docScores.entries()) {
    let finalScore = score;
    if (authorityScores) {
      const auth = authorityScores.get(docId) || 0.0;
      finalScore = score * (1 + alpha * auth);
    }
    results.push({ doc_id: docId, score: finalScore });
  }

  return results.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 1e-9) {
      return a.doc_id - b.doc_id; // Stable secondary sort by doc_id ascending
    }
    return b.score - a.score; // Primary sort by score descending
  });
}
