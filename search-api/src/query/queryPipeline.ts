import { tokenize } from './tokenizer.js';
import { normalize } from './normalizer.js';
import { isStopword } from './stopwords.js';
import { stem } from './stemmer.js';

export interface ProcessedToken {
  term: string;
  position: number;
  field: 'title' | 'heading' | 'body';
}

/**
 * Processes a raw string by tokenizing, normalizing, filtering stopwords,
 * and stemming. Assigns contiguous position indices starting from 0.
 * Identical logic to the indexer pipeline.
 */
export function processText(
  text: string,
  field: 'title' | 'heading' | 'body' = 'body',
  options: { removeNumeric?: boolean } = {}
): ProcessedToken[] {
  const tokens = tokenize(text);
  const normalized = normalize(tokens, options);
  const nonStopwords = normalized.filter(t => !isStopword(t.text));

  return nonStopwords.map((t, index) => ({
    term: stem(t.text),
    position: index,
    field,
  }));
}

/**
 * Processes a query string (or part of it) and returns the clean, stemmed terms.
 * This is used by the parser to get the matching stems.
 */
export function processQueryText(text: string): string[] {
  const tokens = tokenize(text);
  const normalized = normalize(tokens);
  const nonStopwords = normalized.filter(t => !isStopword(t.text));
  return nonStopwords.map(t => stem(t.text));
}
