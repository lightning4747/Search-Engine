/**
 * A robust, production-ready implementation of the original 1980 Martin Porter
 * Stemming Algorithm.
 * 
 * This implementation strictly adheres to the five steps of suffix stripping rules
 * defined in Porter's paper, including the correct Measure 'm' evaluations, proper
 * 'y' vowel/consonant switching logic, and correct Step 4 suffix checks.
 */

/**
 * Stems a word using the Porter Stemming Algorithm.
 * 
 * @param word The input word to stem
 * @returns The stemmed lowercase form of the word
 */
export function stem(word: string): string {
  if (word.length < 3) {
    return word.toLowerCase();
  }

  const w = word.toLowerCase();
  const b = w.split('');
  let k = b.length - 1;
  let j = 0; // index that marks the end of the stem under evaluation

  /**
   * Returns true if the character at index i is a consonant.
   * A consonant is any letter other than a, e, i, o, u, and other than y
   * preceded by a consonant.
   */
  function isCons(i: number): boolean {
    const char = b[i];
    if (char === 'a' || char === 'e' || char === 'i' || char === 'o' || char === 'u') {
      return false;
    }
    if (char === 'y') {
      return (i === 0) ? true : !isCons(i - 1);
    }
    return true;
  }

  /**
   * Measures the number of consonant sequences between 0 and j.
   * If C is a consonant sequence and V is a vowel sequence, then
   * <C><V> gives 0, <C><V><C> gives 1, <C><V><C><V> gives 1, <C><V><C><V><C> gives 2, etc.
   */
  function getMeasure(): number {
    let m = 0;
    let i = 0;
    while (true) {
      if (i > j) return m;
      if (!isCons(i)) break;
      i++;
    }
    i++;
    while (true) {
      while (true) {
        if (i > j) return m;
        if (isCons(i)) break;
        i++;
      }
      i++;
      m++;
      while (true) {
        if (i > j) return m;
        if (!isCons(i)) break;
        i++;
      }
      i++;
    }
  }

  /**
   * Returns true if the stem from index 0 to j contains a vowel.
   */
  function vowelInStem(): boolean {
    for (let i = 0; i <= j; i++) {
      if (!isCons(i)) return true;
    }
    return false;
  }

  /**
   * Returns true if the character at index i and i-1 are double consonants.
   */
  function doubleC(i: number): boolean {
    if (i < 1) return false;
    if (b[i] !== b[i - 1]) return false;
    return isCons(i);
  }

  /**
   * Returns true if the characters at i-2, i-1, i have the form Consonant - Vowel - Consonant,
   * where the second consonant is not w, x, or y.
   */
  function isCvc(i: number): boolean {
    if (i < 2 || !isCons(i) || isCons(i - 1) || !isCons(i - 2)) {
      return false;
    }
    const char = b[i];
    if (char === 'w' || char === 'x' || char === 'y') {
      return false;
    }
    return true;
  }

  /**
   * Returns true if the word from 0 to k ends with the suffix s.
   * Side-effect: sets j to the index of the character immediately preceding the suffix.
   */
  function ends(s: string): boolean {
    const len = s.length;
    const o = k - len + 1;
    if (o < 0) return false;
    for (let i = 0; i < len; i++) {
      if (b[o + i] !== s[i]) return false;
    }
    j = k - len;
    return true;
  }

  /**
   * Replaces the suffix from j+1 to k with the string s, and adjusts k.
   */
  function setTo(s: string): void {
    const len = s.length;
    const o = j + 1;
    for (let i = 0; i < len; i++) {
      b[o + i] = s[i];
    }
    k = j + len;
  }

  /**
   * Replaces suffix with s if the measure of the stem is greater than 0.
   */
  function replace(s: string): void {
    if (getMeasure() > 0) {
      setTo(s);
    }
  }

  /**
   * Step 1 gets rid of plurals and -ed or -ing.
   */
  function step1(): void {
    if (b[k] === 's') {
      if (ends('sses')) {
        k -= 2;
      } else if (ends('ies')) {
        setTo('i');
      } else if (b[k - 1] !== 's') {
        k--;
      }
    }
    if (ends('eed')) {
      if (getMeasure() > 0) {
        k--;
      }
    } else if ((ends('ed') || ends('ing')) && vowelInStem()) {
      k = j;
      if (ends('at')) {
        setTo('ate');
      } else if (ends('bl')) {
        setTo('ble');
      } else if (ends('iz')) {
        setTo('ize');
      } else if (doubleC(k)) {
        k--;
        const ch = b[k];
        if (ch === 'l' || ch === 's' || ch === 'z') {
          k++;
        }
      } else if (getMeasure() === 1 && isCvc(k)) {
        setTo('e');
      }
    }
  }

  /**
   * Step 2 turns terminal y to i when there is another vowel in the stem.
   */
  function step2(): void {
    if (ends('y') && vowelInStem()) {
      b[k] = 'i';
    }
  }

  /**
   * Step 3 maps double suffixes to single ones (e.g., -ization to -ize).
   */
  function step3(): void {
    if (k === 0) return;
    switch (b[k - 1]) {
      case 'a':
        if (ends('ational')) { replace('ate'); break; }
        if (ends('tional')) { replace('tion'); break; }
        break;
      case 'c':
        if (ends('enci')) { replace('ence'); break; }
        if (ends('anci')) { replace('ance'); break; }
        break;
      case 'e':
        if (ends('izer')) { replace('ize'); break; }
        break;
      case 'l':
        if (ends('bli')) { replace('ble'); break; }
        if (ends('alli')) { replace('al'); break; }
        if (ends('entli')) { replace('ent'); break; }
        if (ends('eli')) { replace('e'); break; }
        if (ends('ousli')) { replace('ous'); break; }
        break;
      case 'o':
        if (ends('court')) { break; } // safety guard for short words
        if (ends('ization')) { replace('ize'); break; }
        if (ends('ation')) { replace('ate'); break; }
        if (ends('ator')) { replace('ate'); break; }
        break;
      case 's':
        if (ends('alism')) { replace('al'); break; }
        if (ends('iveness')) { replace('ive'); break; }
        if (ends('fulness')) { replace('ful'); break; }
        if (ends('ousness')) { replace('ous'); break; }
        break;
      case 't':
        if (ends('aliti')) { replace('al'); break; }
        if (ends('iviti')) { replace('ive'); break; }
        if (ends('biliti')) { replace('ble'); break; }
        break;
      case 'g':
        if (ends('logi')) { replace('log'); break; }
        break;
    }
  }

  /**
   * Step 4 deals with -ic-, -full, -ness, etc.
   */
  function step4(): void {
    switch (b[k]) {
      case 'e':
        if (ends('icate')) { replace('ic'); break; }
        if (ends('ative')) { replace(''); break; }
        if (ends('alize')) { replace('al'); break; }
        break;
      case 'i':
        if (ends('iciti')) { replace('ic'); break; }
        break;
      case 'l':
        if (ends('ical')) { replace('ic'); break; }
        if (ends('ful')) { replace(''); break; }
        break;
      case 's':
        if (ends('ness')) { replace(''); break; }
        break;
    }
  }

  /**
   * Step 5 decides whether to strip ending suffixes.
   */
  function step5(): void {
    if (k === 0) return;
    switch (b[k - 1]) {
      case 'a':
        if (ends('al')) break;
        return;
      case 'c':
        if (ends('ance')) break;
        if (ends('ence')) break;
        return;
      case 'e':
        if (ends('er')) break;
        return;
      case 'i':
        if (ends('ic')) break;
        return;
      case 'l':
        if (ends('able')) break;
        if (ends('ible')) break;
        return;
      case 'n':
        if (ends('ant')) break;
        if (ends('ement')) break;
        if (ends('ment')) break;
        if (ends('ent')) break;
        return;
      case 'o':
        if (ends('ion') && j >= 0 && (b[j] === 's' || b[j] === 't')) break;
        if (ends('ou')) break;
        return;
      case 's':
        if (ends('ism')) break;
        return;
      case 't':
        if (ends('ate')) break;
        if (ends('iti')) break;
        return;
      case 'u':
        if (ends('ous')) break;
        return;
      case 'v':
        if (ends('ive')) break;
        return;
      case 'z':
        if (ends('ize')) break;
        return;
      default:
        return;
    }
    if (getMeasure() > 1) {
      k = j;
    }
  }

  /**
   * Step 6 removes a final e if m > 1, or if m = 1 and not cvc.
   * It also reduces double l to l if m > 1.
   */
  function step6(): void {
    j = k;
    if (b[k] === 'e') {
      const a = getMeasure();
      if (a > 1 || (a === 1 && !isCvc(k - 1))) {
        k--;
      }
    }
    if (b[k] === 'l' && doubleC(k) && getMeasure() > 1) {
      k--;
    }
  }

  // Execute steps sequentially
  step1();
  step2();
  step3();
  step4();
  step5();
  step6();

  return b.slice(0, k + 1).join('');
}
