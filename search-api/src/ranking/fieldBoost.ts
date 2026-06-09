import { scoreBM25 } from './bm25.js';

export interface FieldBoosts {
  title: number;
  heading: number;
  body: number;
}

export const DEFAULT_FIELD_BOOSTS: FieldBoosts = {
  title: 3.0,
  heading: 1.8,
  body: 1.0,
};

/**
 * Combines per-field BM25 scores using field-specific multipliers (boosts).
 * 
 * @param tf_title Term frequency in the title
 * @param tf_heading Term frequency in the headings
 * @param tf_body Term frequency in the body
 * @param df Document frequency of the term in the corpus
 * @param N Total number of documents in the corpus
 * @param avgdl Average document length in the corpus
 * @param docLen Length of the document being scored
 * @param boosts Configurable boost multipliers (defaults to title=3.0, heading=1.8, body=1.0)
 * @param k1 Tuning parameter k1 passed to BM25
 * @param b Tuning parameter b passed to BM25
 * @returns The combined field-weighted score for this term and document
 */
export function scoreFieldWeighted(
  tf_title: number,
  tf_heading: number,
  tf_body: number,
  df: number,
  N: number,
  avgdl: number,
  docLen: number,
  boosts: FieldBoosts = DEFAULT_FIELD_BOOSTS,
  k1?: number,
  b?: number
): number {
  const scoreTitle = scoreBM25(tf_title, df, N, avgdl, docLen, k1, b);
  const scoreHeading = scoreBM25(tf_heading, df, N, avgdl, docLen, k1, b);
  const scoreBody = scoreBM25(tf_body, df, N, avgdl, docLen, k1, b);

  return (
    scoreTitle * boosts.title +
    scoreHeading * boosts.heading +
    scoreBody * boosts.body
  );
}
