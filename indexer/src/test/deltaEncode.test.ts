import { describe, it, expect } from 'vitest';
import {
  encodeVByte,
  decodeVByte,
  deltaEncode,
  deltaDecode,
  encodeDocIds,
  decodeDocIds,
} from '../compression/deltaEncode.js';

describe('VByte & Delta Encoding Module', () => {
  describe('VByte encoding/decoding', () => {
    it('should verify delta of 1 encodes to 1 byte', () => {
      const bytes = encodeVByte(1);
      expect(bytes).toHaveLength(1);
      expect(bytes[0]).toBe(1);
    });

    it('should encode and decode simple non-negative integers', () => {
      const testCases = [0, 1, 127, 128, 129, 300, 16383, 16384, 16385, 2097151, 2097152, 268435455];
      for (const val of testCases) {
        const bytes = encodeVByte(val);
        const decoded = decodeVByte(bytes);
        expect(decoded).toEqual([val]);
      }
    });

    it('should roundtrip encode/decode an array of multiple VByte values', () => {
      const values = [10, 1000, 5, 200000, 0];
      const bytes: number[] = [];
      for (const val of values) {
        bytes.push(...encodeVByte(val));
      }
      const decoded = decodeVByte(bytes);
      expect(decoded).toEqual(values);
    });

    it('should throw error when encoding negative values', () => {
      expect(() => encodeVByte(-1)).toThrow();
    });
  });

  describe('Delta encoding/decoding', () => {
    it('should return empty array for empty inputs', () => {
      expect(deltaEncode([])).toEqual([]);
      expect(deltaDecode([])).toEqual([]);
    });

    it('should calculate correct deltas relative to predecessor (starting from 0)', () => {
      const docIds = [3, 8, 15, 16, 100];
      const deltas = deltaEncode(docIds);
      expect(deltas).toEqual([3, 5, 7, 1, 84]);

      const reconstructed = deltaDecode(deltas);
      expect(reconstructed).toEqual(docIds);
    });
  });

  describe('Doc ID Full Roundtrip', () => {
    it('should roundtrip compress and decompress sorted doc IDs', () => {
      const docIds = [12, 15, 300, 450, 451, 100000];
      const buffer = encodeDocIds(docIds);
      const decoded = decodeDocIds(buffer);
      expect(decoded).toEqual(docIds);
    });

    it('should handle empty doc IDs array', () => {
      const buffer = encodeDocIds([]);
      expect(buffer.length).toBe(0);
      expect(decodeDocIds(buffer)).toEqual([]);
    });
  });
});
