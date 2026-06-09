export interface Token {
  text: string;
  startChar: number;
  endChar: number;
  position: number;
}

/**
 * Tokenizes a raw string into an array of Token objects, matching the indexer's tokenizer.
 */
export function tokenize(text: string): Token[] {
  if (!text) {
    return [];
  }

  const tokens: Token[] = [];
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
