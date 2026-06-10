import { CrawledPage } from './loader.js';
import { processText } from './pipeline.js';
import { computeSimHash } from './dedup/fingerprint.js';


export interface TermInfo {
  tf_title: number;
  tf_heading: number;
  tf_body: number;
  positions: number[];
}

export interface DocumentIndex {
  docId: number;
  terms: Map<string, TermInfo>;
  fingerprint: string | null;
  crawledAt?: Date;
}

/**
 * Processes a single CrawledPage and builds an in-memory index of all its terms.
 * Runs processText separately on the title, headings, and body text, and
 * aggregates term frequencies and body position offsets.
 * 
 * @param page The crawled page to index
 * @returns A DocumentIndex object ready for DB write
 */
export function indexDocument(page: CrawledPage): DocumentIndex {
  const threshold = parseInt(process.env.THIN_CONTENT_THRESHOLD || '50', 10);
  
  if (page.word_count < threshold) {
    console.log(`[thin-content] Skipped indexing Doc ID ${page.id} (${page.url}) due to low word count: ${page.word_count} (threshold: ${threshold})`);
    return {
      docId: page.id,
      terms: new Map<string, TermInfo>(),
      fingerprint: null,
      crawledAt: page.crawled_at,
    };
  }

  const terms = new Map<string, TermInfo>();

  const getOrCreateTerm = (term: string): TermInfo => {
    let info = terms.get(term);
    if (!info) {
      info = {
        tf_title: 0,
        tf_heading: 0,
        tf_body: 0,
        positions: [],
      };
      terms.set(term, info);
    }
    return info;
  };

  // 1. Process Title
  if (page.title) {
    const titleTokens = processText(page.title, 'title');
    for (const token of titleTokens) {
      const info = getOrCreateTerm(token.term);
      info.tf_title++;
    }
  }

  // 2. Process Headings (h1, h2, h3)
  if (page.headings) {
    const headingLists = [
      page.headings.h1 || [],
      page.headings.h2 || [],
      page.headings.h3 || [],
    ];
    for (const list of headingLists) {
      for (const headingText of list) {
        if (headingText) {
          const headingTokens = processText(headingText, 'heading');
          for (const token of headingTokens) {
            const info = getOrCreateTerm(token.term);
            info.tf_heading++;
          }
        }
      }
    }
  }

  // 3. Process Body Text (text_content)
  if (page.text_content) {
    const bodyTokens = processText(page.text_content, 'body');
    for (const token of bodyTokens) {
      const info = getOrCreateTerm(token.term);
      info.tf_body++;
      info.positions.push(token.position);
    }
  }

  const fingerprint = computeSimHash(Array.from(terms.keys()));

  return {
    docId: page.id,
    terms,
    fingerprint,
    crawledAt: page.crawled_at,
  };
}
