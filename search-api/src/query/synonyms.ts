import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stem } from './stemmer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const synonymPath = path.resolve(__dirname, '../../data/synonyms.json');

let synonymMap = new Map<string, string[]>();

/**
 * Loads the static synonym map from data/synonyms.json, stems keys and values,
 * and populates the in-memory lookup map.
 */
export function loadSynonyms(): void {
  try {
    if (fs.existsSync(synonymPath)) {
      const content = fs.readFileSync(synonymPath, 'utf-8');
      const data = JSON.parse(content);
      const newMap = new Map<string, string[]>();
      
      for (const [term, list] of Object.entries(data)) {
        if (Array.isArray(list)) {
          const stemmedKey = stem(term.toLowerCase());
          const stemmedList = list.map(t => stem(t.toLowerCase()));
          newMap.set(stemmedKey, stemmedList);
        }
      }
      synonymMap = newMap;
      console.log(`Loaded ${synonymMap.size} synonym groups successfully.`);
    } else {
      console.warn(`Synonyms file not found at: ${synonymPath}`);
    }
  } catch (err) {
    console.error('Failed to load synonyms.json:', err);
  }
}

/**
 * Returns the array of stemmed synonyms for a given stemmed term.
 */
export function getSynonyms(stemmedTerm: string): string[] {
  return synonymMap.get(stemmedTerm) || [];
}
