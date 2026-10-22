import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";

// Mock localStorage for node environment
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    clear: () => {
      store = {};
    },
  };
})();
globalThis.localStorage = localStorageMock;

const {
  isWordValid,
  getSpellingSuggestions,
  addToUserDictionary,
  getUserDictionary,
  damerauLevenshteinDistance,
} = await import("../src/utils/spellcheck.ts");

describe("Spellcheck Utility", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("damerauLevenshteinDistance", () => {
    test("calculates transposition as distance 1", () => {
      assert.strictEqual(damerauLevenshteinDistance("teh", "the"), 1);
      assert.strictEqual(damerauLevenshteinDistance("recieve", "receive"), 1);
    });

    test("calculates single insertions and deletions as 1", () => {
      assert.strictEqual(damerauLevenshteinDistance("cat", "cats"), 1);
      assert.strictEqual(damerauLevenshteinDistance("cats", "cat"), 1);
    });

    test("calculates identical strings as 0", () => {
      assert.strictEqual(damerauLevenshteinDistance("kenote", "kenote"), 0);
    });
  });

  describe("isWordValid", () => {
    test("recognizes base dictionary words", () => {
      assert.strictEqual(isWordValid("hello"), true);
      assert.strictEqual(isWordValid("world"), true);
      assert.strictEqual(isWordValid("markdown"), true);
      assert.strictEqual(isWordValid("kenote"), true);
    });

    test("recognizes morphological variations (plurals, tenses, ing, possessives)", () => {
      assert.strictEqual(isWordValid("notes"), true); // plural
      assert.strictEqual(isWordValid("created"), true); // past tense
      assert.strictEqual(isWordValid("writing"), true); // participle
      assert.strictEqual(isWordValid("user's"), true); // possessive
      assert.strictEqual(isWordValid("quickly"), true); // adverb
    });

    test("flags misspelled words", () => {
      assert.strictEqual(isWordValid("teh"), false);
      assert.strictEqual(isWordValid("recieve"), false);
      assert.strictEqual(isWordValid("definately"), false);
      assert.strictEqual(isWordValid("mispeled"), false);
      assert.strictEqual(isWordValid("wierd"), false);
    });

    test("handles numbers, urls, single chars as valid", () => {
      assert.strictEqual(isWordValid("a"), true);
      assert.strictEqual(isWordValid("I"), true);
      assert.strictEqual(isWordValid("123"), true);
      assert.strictEqual(isWordValid("v2"), true);
      assert.strictEqual(isWordValid("https://example.com"), true);
    });
  });

  describe("getSpellingSuggestions", () => {
    test("suggests 'the' for 'teh'", () => {
      const suggestions = getSpellingSuggestions("teh");
      assert.ok(suggestions.length > 0);
      assert.strictEqual(suggestions[0], "the");
    });

    test("suggests 'receive' for 'recieve'", () => {
      const suggestions = getSpellingSuggestions("recieve");
      assert.ok(suggestions.length > 0);
      assert.strictEqual(suggestions[0], "receive");
    });

    test("suggests 'definitely' for 'definately'", () => {
      const suggestions = getSpellingSuggestions("definately");
      assert.ok(suggestions.length > 0);
      assert.strictEqual(suggestions[0], "definitely");
    });

    test("suggests 'misspelled' for 'mispeled'", () => {
      const suggestions = getSpellingSuggestions("mispeled");
      assert.ok(suggestions.length > 0);
      assert.strictEqual(suggestions[0], "misspelled");
    });

    test("preserves casing in suggestions", () => {
      const titleCase = getSpellingSuggestions("Teh");
      assert.strictEqual(titleCase[0], "The");

      const upperCase = getSpellingSuggestions("TEH");
      assert.strictEqual(upperCase[0], "THE");
    });
  });

  describe("User Custom Dictionary", () => {
    test("adding custom word makes it valid", () => {
      const customWord = "supercalifragilistic";
      assert.strictEqual(isWordValid(customWord), false);

      addToUserDictionary(customWord);
      assert.strictEqual(isWordValid(customWord), true);
      assert.ok(getUserDictionary().has(customWord.toLowerCase()));
    });
  });
});
