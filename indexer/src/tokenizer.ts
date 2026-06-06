export interface Token {
  text: string;
  startChar: number;
  endChar: number;
  position: number;
}

/**
 * Tokenizes a raw string into an array of Token objects.
 * Splits on whitespace and punctuation boundaries, while preserving
 * internal hyphens and apostrophes (e.g. for hyphenated words and contractions).
 * 
 * @param text The raw input text to tokenize
 * @returns Ordered array of tokens with offsets and positions
 */
export function tokenize(text: string): Token[] {
  if (!text) {
    return [];
  }

  const tokens: Token[] = [];
  // Match alphanumeric sequences, optionally containing internal hyphens or apostrophes
  const regex = /[a-zA-Z0-9]+(?:[-'][a-zA-Z0-9]+)*/g;
  let match: RegExpExecArray | null;
  let position = 0;

  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      startChar: match.index,
      endChar: match.index + match[0].length,
      position: position++,
    });
  }

  return tokens;
}
