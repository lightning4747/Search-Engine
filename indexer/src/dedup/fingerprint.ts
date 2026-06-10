import crypto from 'crypto';

/**
 * Computes a 64-bit SimHash fingerprint for an array of unique terms.
 * 
 * @param terms Array of unique token terms in the document
 * @returns 16-character hexadecimal string representing the 64-bit SimHash
 */
export function computeSimHash(terms: string[]): string {
  if (terms.length === 0) {
    return '0000000000000000';
  }

  // Initialize a 64-dimensional weight vector with 0s
  const v = new Array(64).fill(0);

  for (const term of terms) {
    // Hash the term using MD5
    const hash = crypto.createHash('md5').update(term).digest();

    // Read the first 8 bytes of MD5 as two 32-bit unsigned integers
    const low = hash.readUInt32BE(0);
    const high = hash.readUInt32BE(4);

    // Update the 64-dimensional vector based on each bit of the hash
    for (let i = 0; i < 32; i++) {
      const bitLow = (low >>> i) & 1;
      v[i] += bitLow ? 1 : -1;

      const bitHigh = (high >>> i) & 1;
      v[32 + i] += bitHigh ? 1 : -1;
    }
  }

  // Convert the sign vector to a 64-bit BigInt
  let fingerprint = 0n;
  for (let i = 0; i < 64; i++) {
    if (v[i] > 0) {
      fingerprint |= (1n << BigInt(i));
    }
  }

  // Format as a 16-character hex string
  return fingerprint.toString(16).padStart(16, '0');
}

/**
 * Calculates the Hamming distance between two SimHash fingerprints.
 * 
 * @param f1 16-character hex string of the first fingerprint
 * @param f2 16-character hex string of the second fingerprint
 * @returns The number of differing bits (between 0 and 64)
 */
export function hammingDistance(f1: string, f2: string): number {
  const n1 = BigInt('0x' + f1);
  const n2 = BigInt('0x' + f2);
  let xor = n1 ^ n2;

  // Count set bits (population count)
  let count = 0;
  while (xor > 0n) {
    if (xor & 1n) {
      count++;
    }
    xor >>= 1n;
  }
  return count;
}
