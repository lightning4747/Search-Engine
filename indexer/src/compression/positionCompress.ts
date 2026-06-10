import { encodeVByte, decodeVByte, deltaEncode, deltaDecode } from './deltaEncode.js';

/**
 * Compresses an array of sorted, increasing positions into a Buffer using Delta + VByte encoding.
 */
export function compressPositions(positions: number[]): Buffer {
  if (positions.length === 0) {
    return Buffer.alloc(0);
  }
  const deltas = deltaEncode(positions);
  const bytes: number[] = [];
  for (const delta of deltas) {
    bytes.push(...encodeVByte(delta));
  }
  return Buffer.from(bytes);
}

/**
 * Decompresses a Buffer of delta + VByte encoded positions back to absolute positions.
 */
export function decompressPositions(buffer: Buffer): number[] {
  if (buffer.length === 0) {
    return [];
  }
  const deltas = decodeVByte(buffer);
  return deltaDecode(deltas);
}
