/**
 * Intersects two sorted arrays A and B with an offset.
 * Finds all elements `a` in A such that `a + offset` is in B.
 * Takes advantage of both arrays being sorted to run in linear O(A.length + B.length) time.
 */
function intersect(A: number[], B: number[], offset: number): number[] {
  const result: number[] = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    const target = A[i] + offset;
    if (B[j] === target) {
      result.push(A[i]);
      i++;
      j++;
    } else if (B[j] < target) {
      j++;
    } else {
      i++;
    }
  }
  return result;
}

/**
 * Given position arrays for two or more terms, verifies if they appear
 * in consecutive positions (i.e. term 0 at p, term 1 at p+1, term 2 at p+2, etc.).
 * 
 * @param positionLists Array of sorted position arrays for each term in the phrase
 * @returns boolean indicating if there is a consecutive match
 */
export function matchPhrase(positionLists: number[][]): boolean {
  if (positionLists.length === 0) {
    return false;
  }
  // If any term has no positions, the phrase cannot match
  if (positionLists.some(list => list.length === 0)) {
    return false;
  }
  if (positionLists.length === 1) {
    return true;
  }

  let candidates = positionLists[0];

  for (let i = 1; i < positionLists.length; i++) {
    candidates = intersect(candidates, positionLists[i], i);
    if (candidates.length === 0) {
      return false;
    }
  }

  return candidates.length > 0;
}
