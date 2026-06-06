import { describe, it, expect } from 'vitest';
import { isStopword, stopwords } from '../stopwords.js';

describe('Stopwords Module', () => {
  it('should identify common stopwords correctly', () => {
    expect(isStopword('the')).toBe(true);
    expect(isStopword('and')).toBe(true);
    expect(isStopword('a')).toBe(true);
    expect(isStopword('is')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isStopword('THE')).toBe(true);
    expect(isStopword('And')).toBe(true);
    expect(isStopword('aNd')).toBe(true);
  });

  it('should identify contractions (with and without apostrophes) as stopwords', () => {
    expect(isStopword("don't")).toBe(true);
    expect(isStopword('dont')).toBe(true);
    expect(isStopword("it's")).toBe(true);
    expect(isStopword('its')).toBe(true);
  });

  it('should not identify non-stopwords as stopwords', () => {
    expect(isStopword('typescript')).toBe(false);
    expect(isStopword('search')).toBe(false);
    expect(isStopword('engine')).toBe(false);
    expect(isStopword('indexer')).toBe(false);
  });

  it('should have a stopword list of a reasonable size (~150-200)', () => {
    expect(stopwords.size).toBeGreaterThanOrEqual(150);
    expect(stopwords.size).toBeLessThanOrEqual(250);
  });
});
