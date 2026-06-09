import { Token } from './tokenizer.js';

export interface NormalizerOptions {
  /**
   * If true, tokens that are purely numeric (only contain digits) will be removed.
   */
  removeNumeric?: boolean;
}

/**
 * Normalizes a single token by:
 * 1. Converting to lowercase.
 * 2. Striking leading and trailing punctuation.
 * 3. Optionally filtering out purely numeric tokens.
 * 
 * Returns the normalized Token, or null if the token is completely stripped or filtered out.
 */
export function normalizeToken(token: Token, options: NormalizerOptions = {}): Token | null {
  const lowerText = token.text.toLowerCase();

  // Find leading and trailing non-alphanumeric characters
  const leadingMatch = lowerText.match(/^[^a-zA-Z0-9]+/);
  const trailingMatch = lowerText.match(/[^a-zA-Z0-9]+$/);

  const leadingLength = leadingMatch ? leadingMatch[0].length : 0;
  const trailingLength = trailingMatch ? trailingMatch[0].length : 0;

  // If the entire token consists of non-alphanumeric characters, filter it out
  if (leadingLength === lowerText.length) {
    return null;
  }

  const normalizedText = lowerText.slice(leadingLength, lowerText.length - trailingLength);

  // Filter out excessively long tokens (e.g. base64 or garbage data) to prevent index key size limits
  if (normalizedText.length > 255) {
    return null;
  }

  // Filter out purely numeric tokens if option is enabled
  if (options.removeNumeric && /^\d+$/.test(normalizedText)) {
    return null;
  }

  return {
    text: normalizedText,
    startChar: token.startChar + leadingLength,
    endChar: token.endChar - trailingLength,
    position: token.position,
  };
}

/**
 * Normalizes an array of tokens, returning only the non-null results.
 */
export function normalize(tokens: Token[], options: NormalizerOptions = {}): Token[] {
  const result: Token[] = [];
  for (const token of tokens) {
    const normalized = normalizeToken(token, options);
    if (normalized) {
      result.push(normalized);
    }
  }
  return result;
}
