import { tokenize } from './tokenizer.js';
import { normalizeToken } from './normalizer.js';
import { stem } from './stemmer.js';
import { isStopword } from './stopwords.js';
import { trie, commonTerms } from '../suggest/trieLoader.js';

/**
 * Computes the Damerau-Levenshtein distance between two strings.
 * Includes insertions, deletions, substitutions, and transpositions of adjacent characters.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const h = a.length;
  const w = b.length;
  if (h === 0) return w;
  if (w === 0) return h;

  // Initialize distance matrix
  const d: number[][] = [];
  for (let i = 0; i <= h; i++) {
    d[i] = [];
    d[i][0] = i;
  }
  for (let j = 0; j <= w; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= h; i++) {
    for (let j = 1; j <= w; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost  // substitution
      );

      // Transposition check
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(
          d[i][j],
          d[i - 2][j - 2] + cost
        );
      }
    }
  }

  return d[h][w];
}

/**
 * Parses a raw query string, finds misspelled terms (not found in terms vocabulary),
 * and suggests corrections for them if a suitable term exists in commonTerms (distance <= 2).
 * Returns the corrected query string, or null if no corrections were made.
 */
export function suggestCorrection(rawQuery: string): string | null {
  if (!rawQuery) return null;

  const tokens = tokenize(rawQuery);
  let correctedQuery = rawQuery;
  let offset = 0;
  let hasCorrection = false;

  for (const token of tokens) {
    const normalized = normalizeToken(token);
    if (!normalized) continue;

    const clean = normalized.text;
    if (isStopword(clean)) continue;

    const stemmed = stem(clean);
    // If the term exists in the prefix trie vocabulary, it's correct
    if (trie.exists(stemmed)) continue;

    // Otherwise, it's a spelling candidate, search space is commonTerms
    let bestTerm: string | null = null;
    let minDistance = 3; // We only care about distance <= 2
    let bestFreq = -1;

    for (const candidate of commonTerms) {
      const dist = damerauLevenshtein(stemmed, candidate.term);
      if (dist <= 2) {
        if (dist < minDistance) {
          minDistance = dist;
          bestTerm = candidate.term;
          bestFreq = candidate.docFrequency;
        } else if (dist === minDistance) {
          if (candidate.docFrequency > bestFreq) {
            bestTerm = candidate.term;
            bestFreq = candidate.docFrequency;
          } else if (candidate.docFrequency === bestFreq && bestTerm && candidate.term.localeCompare(bestTerm) < 0) {
            bestTerm = candidate.term;
          }
        }
      }
    }

    if (bestTerm && bestTerm !== clean && bestTerm !== stemmed) {
      // Apply correction
      const start = token.startChar + offset;
      const end = token.endChar + offset;
      
      correctedQuery = correctedQuery.slice(0, start) + bestTerm + correctedQuery.slice(end);
      offset += bestTerm.length - token.text.length;
      hasCorrection = true;
    }
  }

  return hasCorrection ? correctedQuery : null;
}
