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
 * 
 * @param text The raw input string
 * @param field The field type ('title' | 'heading' | 'body')
 * @param options Optional normalizer configuration
 * @returns Ordered array of processed tokens
 */
export function processText(
  text: string,
  field: 'title' | 'heading' | 'body',
  options: { removeNumeric?: boolean } = {}
): ProcessedToken[] {
  const tokens = tokenize(text);
  const normalized = normalize(tokens, options);
  const nonStopwords = normalized.filter(t => !isStopword(t.text));

  return nonStopwords.map((t, index) => ({
    term: stem(t.text),
    position: index, // contiguous position sequence starting from 0
    field,
  }));
}
