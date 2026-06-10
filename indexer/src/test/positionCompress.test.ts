import { describe, it, expect } from 'vitest';
import { compressPositions, decompressPositions } from '../compression/positionCompress.js';

describe('Position Array Compression Module', () => {
  it('should compress and decompress an empty array of positions', () => {
    const compressed = compressPositions([]);
    expect(compressed.length).toBe(0);

    const decompressed = decompressPositions(compressed);
    expect(decompressed).toEqual([]);
  });

  it('should roundtrip compress/decompress a list of sorted positions', () => {
    const positions = [5, 12, 100, 105, 500, 20000];
    const compressed = compressPositions(positions);
    const decompressed = decompressPositions(compressed);
    expect(decompressed).toEqual(positions);
  });

  it('should correctly handle a single position', () => {
    const positions = [42];
    const compressed = compressPositions(positions);
    const decompressed = decompressPositions(compressed);
    expect(decompressed).toEqual(positions);
  });

  it('should handle large gaps and verify positions reconstruct correctly', () => {
    const positions = [10, 1000000]; // delta of 999990 (takes multiple bytes in VByte)
    const compressed = compressPositions(positions);
    const decompressed = decompressPositions(compressed);
    expect(decompressed).toEqual(positions);
  });
});
