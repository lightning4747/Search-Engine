/**
 * Variable-Byte (VByte) and Delta encoding utilities for index compression.
 */

/**
 * Encodes a single non-negative integer using VByte encoding.
 * Uses groups of 7 bits, with the MSB as a continuation flag (1 = more bytes follow, 0 = last byte).
 */
export function encodeVByte(value: number): number[] {
  if (value < 0) {
    throw new Error('VByte encoding only supports non-negative integers');
  }
  const bytes: number[] = [];
  let val = value;
  while (val >= 128) {
    bytes.push((val & 0x7f) | 0x80);
    val >>>= 7;
  }
  bytes.push(val & 0x7f);
  return bytes;
}

/**
 * Decodes a sequence of VByte-encoded integers from a buffer or array.
 */
export function decodeVByte(bytes: number[] | Buffer | Uint8Array): number[] {
  const values: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    let val = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = bytes[i++];
      val |= (byte & 0x7f) << shift;
      shift += 7;
    } while ((byte & 0x80) !== 0 && i < bytes.length);
    values.push(val);
  }
  return values;
}

/**
 * Computes deltas of a sorted list of numbers relative to their predecessor (the first is relative to 0).
 */
export function deltaEncode(numbers: number[]): number[] {
  if (numbers.length === 0) return [];
  const deltas: number[] = [];
  let prev = 0;
  for (const num of numbers) {
    deltas.push(num - prev);
    prev = num;
  }
  return deltas;
}

/**
 * Reconstructs absolute numbers from a list of deltas starting from 0.
 */
export function deltaDecode(deltas: number[]): number[] {
  if (deltas.length === 0) return [];
  const numbers: number[] = [];
  let current = 0;
  for (const delta of deltas) {
    current += delta;
    numbers.push(current);
  }
  return numbers;
}

/**
 * Compresses an array of sorted document IDs using delta + VByte encoding.
 */
export function encodeDocIds(docIds: number[]): Buffer {
  const deltas = deltaEncode(docIds);
  const bytes: number[] = [];
  for (const delta of deltas) {
    bytes.push(...encodeVByte(delta));
  }
  return Buffer.from(bytes);
}

/**
 * Decompresses a buffer of delta + VByte encoded document IDs back to sorted IDs.
 */
export function decodeDocIds(buffer: Buffer): number[] {
  if (buffer.length === 0) return [];
  const deltas = decodeVByte(buffer);
  return deltaDecode(deltas);
}
