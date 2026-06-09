/**
 * Verifies if the minimum distance between any element in pos1 and any element in pos2 is <= N.
 * Runs in linear O(pos1.length + pos2.length) time using a two-pointer walk on sorted arrays.
 * 
 * @param pos1 Sorted position array of term 1
 * @param pos2 Sorted position array of term 2
 * @param N Maximum allowed distance (inclusive)
 * @returns boolean indicating if the proximity constraint is met
 */
export function matchProximity(pos1: number[], pos2: number[], N: number): boolean {
  if (pos1.length === 0 || pos2.length === 0) {
    return false;
  }

  let i = 0;
  let j = 0;

  while (i < pos1.length && j < pos2.length) {
    const diff = Math.abs(pos1[i] - pos2[j]);
    if (diff <= N) {
      return true;
    }

    if (pos1[i] < pos2[j]) {
      i++;
    } else {
      j++;
    }
  }

  return false;
}
