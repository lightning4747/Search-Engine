/**
 * Calculates the BM25 score for a single term matching a document.
 * Robertson BM25 formula with IDF floor at 0.
 * 
 * @param tf Term frequency of the term in the document
 * @param df Document frequency of the term in the corpus
 * @param N Total number of documents in the corpus
 * @param avgdl Average document length in the corpus
 * @param docLen Length of the document being scored
 * @param k1 Tuning parameter k1 (default: 1.5)
 * @param b Tuning parameter b (default: 0.75)
 * @returns The BM25 score
 */
export function scoreBM25(
  tf: number,
  df: number,
  N: number,
  avgdl: number,
  docLen: number,
  k1: number = 1.5,
  b: number = 0.75
): number {
  if (tf <= 0) {
    return 0;
  }

  // Calculate IDF using Robertson formula: log( (N - df + 0.5) / (df + 0.5) + 1 )
  // We use natural logarithm (Math.log) and floor the IDF at 0.
  const idfNumerator = N - df + 0.5;
  const idfDenominator = df + 0.5;
  const idf = Math.max(0, Math.log(idfNumerator / idfDenominator + 1));

  // Handle edge case where avgdl is <= 0
  const ratio = avgdl > 0 ? docLen / avgdl : 1;

  // Calculate BM25 term frequency saturation
  const tfComponent = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * ratio));

  return idf * tfComponent;
}
