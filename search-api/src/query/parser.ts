import { processQueryText } from './queryPipeline.js';

export interface PhraseClause {
  terms: string[];
}

export interface ProximityClause {
  terms: string[];
  distance: number;
}

export interface RetrievalPlan {
  must: string[];
  exclude: string[];
  phrase: PhraseClause[];
  proximity: ProximityClause[];
}

/**
 * Parses a raw query string into a structured RetrievalPlan.
 * Supports:
 * - Quoted phrases ("exact phrase") -> phrase clause
 * - Proximity operator (term1 ~N term2) -> proximity clause
 * - Exclusion (-term) -> exclude list
 * - Standard terms -> must list
 * 
 * All terms are tokenized, normalized, and stemmed. Stopwords are filtered out.
 */
export function parseQuery(rawQuery: string): RetrievalPlan {
  const plan: RetrievalPlan = {
    must: [],
    exclude: [],
    phrase: [],
    proximity: []
  };

  if (!rawQuery) {
    return plan;
  }

  // 1. Extract quoted phrases
  const phraseRegex = /"([^"]+)"/g;
  let match: RegExpExecArray | null;
  
  while ((match = phraseRegex.exec(rawQuery)) !== null) {
    const phraseText = match[1];
    const phraseTerms = processQueryText(phraseText);
    if (phraseTerms.length > 0) {
      plan.phrase.push({ terms: phraseTerms });
      for (const term of phraseTerms) {
        if (!plan.must.includes(term)) {
          plan.must.push(term);
        }
      }
    }
  }

  // Replace phrases with spaces to keep term separation
  const queryWithoutPhrases = rawQuery.replace(phraseRegex, ' ');

  // 2. Tokenize the remaining query string by whitespace
  const tokens = queryWithoutPhrases.split(/\s+/).filter(Boolean);

  // 3. Process tokens (Exclusion, Proximity, Standard terms)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Check for proximity operator: ~N
    const proxMatch = token.match(/^~(\d+)$/);
    if (proxMatch && i > 0 && i < tokens.length - 1) {
      const dist = parseInt(proxMatch[1], 10);
      const prevToken = tokens[i - 1];
      const nextToken = tokens[i + 1];

      // Ensure prev and next are standard terms (not exclusions or other proximity operators)
      if (!prevToken.startsWith('-') && !prevToken.startsWith('~') &&
          !nextToken.startsWith('-') && !nextToken.startsWith('~')) {
        const prevStems = processQueryText(prevToken);
        const nextStems = processQueryText(nextToken);

        if (prevStems.length === 1 && nextStems.length === 1) {
          plan.proximity.push({
            terms: [prevStems[0], nextStems[0]],
            distance: dist
          });
          // Ensure they are also in the must list so they get retrieved and scored
          if (!plan.must.includes(prevStems[0])) {
            plan.must.push(prevStems[0]);
          }
          if (!plan.must.includes(nextStems[0])) {
            plan.must.push(nextStems[0]);
          }
        }
      }
      continue;
    }

    // Check for exclusion term: -term
    if (token.startsWith('-') && token.length > 1) {
      const excludeText = token.slice(1);
      const excludeStems = processQueryText(excludeText);
      for (const stem of excludeStems) {
        if (!plan.exclude.includes(stem)) {
          plan.exclude.push(stem);
        }
      }
      continue;
    }

    // Ignore other isolated ~ tokens
    if (token.startsWith('~')) {
      continue;
    }

    // Standard term
    const stems = processQueryText(token);
    for (const stem of stems) {
      if (!plan.must.includes(stem)) {
        plan.must.push(stem);
      }
    }
  }

  return plan;
}
