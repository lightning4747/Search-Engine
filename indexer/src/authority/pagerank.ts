/**
 * Computes PageRank scores for a set of nodes and their link lists.
 * Standard iterative PageRank with dangling node redistribution.
 *
 * @param nodes Set of all document IDs
 * @param adjacencyList Map of doc_id to Set of out-links
 * @param inboundList Map of doc_id to Set of in-links
 * @param d Damping factor (default 0.85)
 * @param epsilon Convergence threshold (default 1e-6)
 * @param maxIterations Maximum number of iterations (default 1000)
 */
export function computePageRank(
  nodes: Set<number>,
  adjacencyList: Map<number, Set<number>>,
  inboundList: Map<number, Set<number>>,
  d: number = 0.85,
  epsilon: number = 1e-6,
  maxIterations: number = 1000
): Map<number, number> {
  const N = nodes.size;
  if (N === 0) {
    return new Map<number, number>();
  }

  // Initialize PageRank vector: PR[u] = 1 / N
  let pr = new Map<number, number>();
  for (const docId of nodes) {
    pr.set(docId, 1 / N);
  }

  const startTime = Date.now();
  let iterations = 0;
  let converged = false;

  // Pre-calculate out-degrees for all nodes
  const outDegrees = new Map<number, number>();
  const danglingNodes: number[] = [];
  
  for (const docId of nodes) {
    const outLinks = adjacencyList.get(docId);
    const outDegree = outLinks ? outLinks.size : 0;
    outDegrees.set(docId, outDegree);
    if (outDegree === 0) {
      danglingNodes.push(docId);
    }
  }

  while (iterations < maxIterations && !converged) {
    const newPr = new Map<number, number>();
    
    // Calculate total PageRank of dangling nodes
    let danglingSum = 0;
    for (const dNode of danglingNodes) {
      danglingSum += pr.get(dNode) || 0;
    }

    // Teleportation share + dangling nodes distribution
    const baseShare = (1 - d) / N + (d * danglingSum) / N;

    // Calculate new PageRank for each node
    for (const docId of nodes) {
      let inboundSum = 0;
      const inLinks = inboundList.get(docId);
      if (inLinks) {
        for (const srcId of inLinks) {
          const outDegree = outDegrees.get(srcId) || 0;
          if (outDegree > 0) {
            inboundSum += (pr.get(srcId) || 0) / outDegree;
          }
        }
      }
      newPr.set(docId, baseShare + d * inboundSum);
    }

    // Check convergence: L1 norm of (newPr - pr)
    let l1Diff = 0;
    for (const docId of nodes) {
      l1Diff += Math.abs((newPr.get(docId) || 0) - (pr.get(docId) || 0));
    }

    pr = newPr;
    iterations++;

    if (l1Diff < epsilon) {
      converged = true;
    }
  }

  const duration = Date.now() - startTime;
  console.log(`PageRank computed in ${iterations} iterations (took ${duration}ms, converged=${converged})`);

  return pr;
}
