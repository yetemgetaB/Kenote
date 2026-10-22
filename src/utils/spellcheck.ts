import { BASE_WORDS, COMMON_TYPOS } from "./baseDictionary.ts";

const USER_DICT_STORAGE_KEY = "kenote_user_dictionary";

// Pre-build Set for O(1) membership lookups
const baseDictionarySet: Set<string> = new Set(BASE_WORDS.map((w) => w.toLowerCase()));

// In-memory cache for user dictionary
let userDictionaryCache: Set<string> | null = null;

export function getUserDictionary(): Set<string> {
  if (userDictionaryCache !== null) {
    return userDictionaryCache;
  }
  userDictionaryCache = new Set<string>();
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(USER_DICT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((w) => {
            if (typeof w === "string" && w.trim()) {
              userDictionaryCache?.add(w.toLowerCase().trim());
            }
          });
        }
      }
    }
  } catch (err) {
    console.warn("Could not load user dictionary:", err);
  }
  return userDictionaryCache;
}

export function addToUserDictionary(word: string): void {
  const clean = word.toLowerCase().trim();
  if (!clean) return;

  const userDict = getUserDictionary();
  userDict.add(clean);

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(USER_DICT_STORAGE_KEY, JSON.stringify(Array.from(userDict)));
    }
  } catch (err) {
    console.warn("Could not save to user dictionary:", err);
  }
}

/**
 * Checks morphological root variations (plurals, tenses, suffixes, prefixes).
 */
function checkMorphology(word: string, dict: Set<string>): boolean {
  // Possessive: note's -> note
  if (word.endsWith("'s") && dict.has(word.slice(0, -2))) return true;

  // Plurals: -s, -es, -ies
  if (word.endsWith("s")) {
    if (dict.has(word.slice(0, -1))) return true;
    if (word.endsWith("es") && dict.has(word.slice(0, -2))) return true;
    if (word.endsWith("ies") && dict.has(word.slice(0, -3) + "y")) return true;
  }

  // Past tense: -ed, -ied
  if (word.endsWith("ed")) {
    if (dict.has(word.slice(0, -1))) return true; // e.g. like -> liked
    if (dict.has(word.slice(0, -2))) return true; // e.g. jump -> jumped
    if (word.endsWith("ied") && dict.has(word.slice(0, -3) + "y")) return true; // e.g. carry -> carried
  }

  // Participle: -ing
  if (word.endsWith("ing")) {
    const root = word.slice(0, -3);
    if (dict.has(root)) return true; // e.g. jumping
    if (dict.has(root + "e")) return true; // e.g. making
    if (root.length >= 3 && root[root.length - 1] === root[root.length - 2] && dict.has(root.slice(0, -1))) {
      return true; // e.g. running -> run
    }
  }

  // Adverb: -ly
  if (word.endsWith("ly") && dict.has(word.slice(0, -2))) return true;

  // Prefixes: un-, re-, dis-, pre-
  for (const prefix of ["un", "re", "dis", "pre"]) {
    if (word.startsWith(prefix) && dict.has(word.slice(prefix.length))) {
      return true;
    }
  }

  return false;
}

/**
 * Validates whether a given word is recognized as correct.
 */
export function isWordValid(word: string): boolean {
  if (!word) return true;
  const clean = word.toLowerCase().trim();

  // Short words (1 character) or numbers or mixed alphanumerics are considered valid
  if (clean.length <= 1) return true;
  if (/^\d+$/.test(clean) || /\d/.test(clean)) return true;

  // URLs, file paths, emails
  if (clean.includes("/") || clean.includes("\\") || clean.includes("@") || clean.startsWith("http")) {
    return true;
  }

  // Check user dictionary first
  const userDict = getUserDictionary();
  if (userDict.has(clean)) return true;

  // Check base dictionary
  if (baseDictionarySet.has(clean)) return true;

  // Check morphology
  if (checkMorphology(clean, baseDictionarySet) || checkMorphology(clean, userDict)) {
    return true;
  }

  return false;
}

/**
 * Calculates Damerau-Levenshtein distance between two strings,
 * including insertions, deletions, substitutions, and transpositions.
 */
export function damerauLevenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const d: number[][] = [];
  for (let i = 0; i <= la; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= lb; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[la][lb];
}

/**
 * Formats a suggestion to match the casing of the original word.
 */
function matchCasing(original: string, suggestion: string): string {
  if (!original || !suggestion) return suggestion;

  // All uppercase: "TEH" -> "THE"
  if (original === original.toUpperCase() && original.toLowerCase() !== original.toUpperCase()) {
    return suggestion.toUpperCase();
  }

  // Title case: "Teh" -> "The"
  if (original[0] === original[0].toUpperCase()) {
    return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
  }

  // Lowercase: "teh" -> "the"
  return suggestion.toLowerCase();
}

/**
 * Generates spelling suggestions for a misspelled word.
 */
export function getSpellingSuggestions(word: string, maxSuggestions = 4): string[] {
  if (!word) return [];
  const clean = word.toLowerCase().trim();
  if (clean.length <= 1) return [];

  const results: { suggestion: string; score: number }[] = [];
  const seen = new Set<string>();

  // 1. Check known typo map first for guaranteed high-quality suggestions
  const directTypo = COMMON_TYPOS[clean];
  if (directTypo && directTypo.length > 0) {
    for (const typoMatch of directTypo) {
      const formatted = matchCasing(word, typoMatch);
      if (!seen.has(formatted.toLowerCase())) {
        seen.add(formatted.toLowerCase());
        results.push({ suggestion: formatted, score: 300 });
      }
    }
  }

  // 2. Search base dictionary and user dictionary
  const userDict = getUserDictionary();
  const allWords = [...BASE_WORDS, ...Array.from(userDict)];

  const cleanLen = clean.length;

  for (const candidate of allWords) {
    const candLower = candidate.toLowerCase();
    const candLen = candLower.length;

    // Prune candidates whose lengths differ by more than 2
    if (Math.abs(candLen - cleanLen) > 2) continue;
    if (candLower === clean) continue;
    if (seen.has(candLower)) continue;

    const dist = damerauLevenshteinDistance(clean, candLower);
    if (dist <= 2) {
      let score = dist === 1 ? 100 : 50;

      // Bonus if first letter matches
      if (clean[0] === candLower[0]) score += 25;

      // Bonus if last letter matches
      if (clean[cleanLen - 1] === candLower[candLen - 1]) score += 10;

      // Penalty for length divergence
      score -= Math.abs(candLen - cleanLen) * 5;

      results.push({
        suggestion: matchCasing(word, candidate),
        score,
      });
      seen.add(candLower);
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxSuggestions).map((r) => r.suggestion);
}
