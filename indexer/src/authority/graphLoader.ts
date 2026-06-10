import { query } from '../db/client.js';

export interface LinkGraph {
  nodes: Set<number>;
  adjacencyList: Map<number, Set<number>>; // doc_id -> Set of out-link doc_ids
  inboundList: Map<number, Set<number>>;   // doc_id -> Set of in-link doc_ids
}

/**
 * Loads the active page link graph from the database.
 * Maps URLs to internal doc_ids via joining links with crawled_pages.
 */
export async function loadLinkGraph(): Promise<LinkGraph> {
  // 1. Get all active document IDs
  const pagesRes = await query(
    'SELECT id FROM crawled_pages WHERE is_active = true'
  );
  
  const nodes = new Set<number>();
  const adjacencyList = new Map<number, Set<number>>();
  const inboundList = new Map<number, Set<number>>();

  for (const row of pagesRes.rows) {
    const docId = Number(row.id);
    nodes.add(docId);
    adjacencyList.set(docId, new Set<number>());
    inboundList.set(docId, new Set<number>());
  }

  // 2. Fetch all link relationships between active crawled pages
  const linksRes = await query(
    `SELECT cp_from.id AS src_doc_id, cp_to.id AS dst_doc_id
     FROM links l
     JOIN crawled_pages cp_from ON l.from_url_id = cp_from.url_id
     JOIN crawled_pages cp_to ON l.to_url_id = cp_to.url_id
     WHERE cp_from.is_active = true AND cp_to.is_active = true`
  );

  for (const row of linksRes.rows) {
    const srcId = Number(row.src_doc_id);
    const dstId = Number(row.dst_doc_id);

    // Skip self-loops for cleaner authority distribution
    if (srcId === dstId) {
      continue;
    }

    // Populate adjacency and inbound lists
    adjacencyList.get(srcId)?.add(dstId);
    inboundList.get(dstId)?.add(srcId);
  }

  return {
    nodes,
    adjacencyList,
    inboundList,
  };
}
