import { tokenize, Token } from '../query/tokenizer.js';
import { isStopword } from '../query/stopwords.js';

// Helper to escape HTML characters to prevent XSS injection from body text
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Generates a snippet of the body text highlighting the matching terms.
 * Finds the highest-density window of query hits and extracts a ±40-token context around it.
 * Escapes body text to prevent XSS, preserving only the <mark> highlight tags.
 * 
 * @param input Object containing:
 *   - bodyText: Raw text content of the document
 *   - matchedTerms: List of stemmed query terms that matched
 *   - positions: Map or Record of query term to positions (non-stopword offsets)
 * @returns HTML string containing the snippet with <mark> tags
 */
export function generateSnippet(input: {
  bodyText: string;
  matchedTerms: string[];
  positions: Map<string, number[]> | Record<string, number[]>;
}): string {
  const { bodyText, matchedTerms, positions } = input;

  if (!bodyText) {
    return '';
  }

  const allTokens = tokenize(bodyText);
  if (allTokens.length === 0) {
    return '';
  }

  // 1. Normalize positions to a Map
  const positionsMap = positions instanceof Map
    ? positions
    : new Map(Object.entries(positions));

  // 2. Filter allTokens to build the non-stopword sequence
  // This matches how the indexer filters tokens (ignoring purely punctuation tokens and stopwords)
  const filteredTokens: { token: Token; index: number }[] = [];
  
  for (const token of allTokens) {
    const lower = token.text.toLowerCase();
    
    // Find leading/trailing alphanumeric characters
    const clean = lower.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '');
    
    // Ignore purely punctuation tokens
    if (clean.length === 0) {
      continue;
    }
    
    // Ignore tokens longer than 255 characters (indexer length limit)
    if (clean.length > 255) {
      continue;
    }

    // Ignore stopwords
    if (isStopword(clean)) {
      continue;
    }

    filteredTokens.push({
      token,
      index: token.position, // position in allTokens
    });
  }

  // 3. Map matched term positions from filteredTokens back to allTokens indices
  const matchedTokensMap = new Map<number, string>(); // allTokenIndex -> term stem (lowercase)
  const queryStems = new Set(matchedTerms.map(t => t.toLowerCase()));

  for (const [term, posList] of positionsMap.entries()) {
    if (!queryStems.has(term.toLowerCase())) {
      continue;
    }

    for (const p of posList) {
      if (p >= 0 && p < filteredTokens.length) {
        const allTokenIdx = filteredTokens[p].index;
        matchedTokensMap.set(allTokenIdx, term.toLowerCase());
      }
    }
  }

  // 4. Handle fallback if no matched tokens are found in the text
  if (matchedTokensMap.size === 0) {
    const endIdx = Math.min(allTokens.length - 1, 79);
    let snippet = bodyText.slice(allTokens[0].startChar, allTokens[endIdx].endChar);
    if (allTokens.length > 80) {
      snippet += ' ...';
    }
    return escapeHtml(snippet);
  }

  // 5. Find the highest-density window of size W = 80 tokens
  const W = 80;
  const matchIndices = Array.from(matchedTokensMap.keys()).sort((a, b) => a - b);

  let bestScore = -1;
  let bestStart = 0;
  let bestEnd = 0;

  for (const startIdx of matchIndices) {
    const endIdx = startIdx + W - 1;
    
    const uniqueTermsInWindow = new Set<string>();
    let hitsInWindow = 0;
    
    for (const idx of matchIndices) {
      if (idx >= startIdx && idx <= endIdx) {
        hitsInWindow++;
        const term = matchedTokensMap.get(idx);
        if (term) uniqueTermsInWindow.add(term);
      }
    }
    
    // Reward windows with more unique term matches first, and use total hit count as tie-breaker
    const score = uniqueTermsInWindow.size * 1000 + hitsInWindow;
    if (score > bestScore) {
      bestScore = score;
      bestStart = startIdx;
      bestEnd = Math.min(allTokens.length - 1, endIdx);
    }
  }

  // 6. Extract ±40-token context around the best window
  const startCtx = Math.max(0, bestStart - 40);
  const endCtx = Math.min(allTokens.length - 1, bestEnd + 40);

  const matchedTokensInSnippet = allTokens
    .slice(startCtx, endCtx + 1)
    .filter(t => matchedTokensMap.has(t.position));

  // 7. Construct HTML snippet piece-by-piece, escaping text and wrapping hits in <mark>
  const snippetStartChar = allTokens[startCtx].startChar;
  const snippetEndChar = allTokens[endCtx].endChar;
  
  let lastIndex = snippetStartChar;
  let html = '';

  for (const token of matchedTokensInSnippet) {
    if (token.startChar > lastIndex) {
      html += escapeHtml(bodyText.slice(lastIndex, token.startChar));
    }
    const matchedText = bodyText.slice(token.startChar, token.endChar);
    html += `<mark>${escapeHtml(matchedText)}</mark>`;
    lastIndex = token.endChar;
  }

  if (lastIndex < snippetEndChar) {
    html += escapeHtml(bodyText.slice(lastIndex, snippetEndChar));
  }

  // 8. Add ellipsis prefix/suffix if truncated
  if (startCtx > 0) {
    html = '... ' + html;
  }
  if (endCtx < allTokens.length - 1) {
    html = html + ' ...';
  }

  return html;
}
