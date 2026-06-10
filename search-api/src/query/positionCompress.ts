/**
 * Variable-Byte (VByte) and Delta encoding utilities for index compression.
 * Replicated in search-api for complete modularity and independent packaging.
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
