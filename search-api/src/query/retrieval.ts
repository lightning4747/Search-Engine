import { query } from '../db/client.js';
import { RetrievalPlan } from './parser.js';
import { PostingRow } from '../ranking/ranker.js';

/**
 * Given a RetrievalPlan, fetches postings for all must + phrase + proximity terms
 * in a single batched query, and filters out any doc_ids containing excluded terms.
 * 
 * @param plan The parsed RetrievalPlan
 * @returns Array of PostingRow objects for the candidates
 */
export async function retrievePostings(plan: RetrievalPlan): Promise<PostingRow[]> {
  // Aggregate all unique positive terms
  const positiveTerms = new Set<string>();
  
  for (const term of plan.must) {
    positiveTerms.add(term.toLowerCase());
  }
  for (const clause of plan.phrase) {
    for (const term of clause.terms) {
      positiveTerms.add(term.toLowerCase());
    }
  }
  for (const clause of plan.proximity) {
    for (const term of clause.terms) {
      positiveTerms.add(term.toLowerCase());
    }
  }

  // If there are no positive terms, return empty array immediately
  if (positiveTerms.size === 0) {
    return [];
  }

  const positiveTermsArray = Array.from(positiveTerms);
  const excludeTermsArray = plan.exclude.map(t => t.toLowerCase());

  let queryText = `
    SELECT p.doc_id, t.term, p.tf_title, p.tf_heading, p.tf_body, p.positions, t.doc_frequency as df
    FROM postings p
    JOIN terms t ON p.term_id = t.term_id
    WHERE t.term = ANY($1::text[])
  `;
  const params: any[] = [positiveTermsArray];

  if (excludeTermsArray.length > 0) {
    queryText += `
      AND p.doc_id NOT IN (
        SELECT DISTINCT p2.doc_id
        FROM postings p2
        JOIN terms t2 ON p2.term_id = t2.term_id
        WHERE t2.term = ANY($2::text[])
      )
    `;
    params.push(excludeTermsArray);
  }

  const res = await query(queryText, params);

  return res.rows.map(row => ({
    term: row.term,
    doc_id: Number(row.doc_id),
    tf_title: Number(row.tf_title || 0),
    tf_heading: Number(row.tf_heading || 0),
    tf_body: Number(row.tf_body || 0),
    positions: row.positions || [],
    df: Number(row.df || 0)
  }));
}
