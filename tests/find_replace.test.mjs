import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body><div id='editor'></div></body></html>", {
  url: "http://localhost",
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
globalThis.Node = dom.window.Node;
globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;

const StarterKit = (await import("@tiptap/starter-kit")).default;
const { Editor } = await import("@tiptap/core");
const {
  SearchAndReplace,
  buildSearchRegex,
  findMatchesInDoc,
  searchAndReplacePluginKey,
} = await import("../src/extensions/SearchAndReplace.ts");

function createSearchEditor(initialContent = "<p>Initial paragraph</p>") {
  return new Editor({
    extensions: [
      StarterKit,
      SearchAndReplace,
    ],
    content: initialContent,
  });
}

describe("Find and Replace Feature Tests", () => {
  describe("1. buildSearchRegex", () => {
    it("returns null for empty search string", () => {
      assert.equal(buildSearchRegex("", false, false), null);
    });

    it("escapes regex special characters safely", () => {
      const regex = buildSearchRegex("foo.bar [test] (1+1)", false, false);
      assert.ok(regex !== null);
      assert.equal(regex.source, "foo\\.bar \\[test\\] \\(1\\+1\\)");
      assert.equal(regex.test("foo.bar [test] (1+1)"), true);
      assert.equal(regex.test("fooxbar [test] (1+1)"), false);
    });

    it("toggles case sensitivity flags", () => {
      const caseInsensitive = buildSearchRegex("KeNote", false, false);
      const caseSensitive = buildSearchRegex("KeNote", true, false);

      assert.ok(caseInsensitive !== null);
      assert.ok(caseSensitive !== null);
      assert.equal(caseInsensitive.flags.includes("i"), true);
      assert.equal(caseSensitive.flags.includes("i"), false);
      assert.equal(caseInsensitive.test("kenote"), true);
      assert.equal(caseSensitive.test("kenote"), false);
      assert.equal(caseSensitive.test("KeNote"), true);
    });

    it("enforces whole word boundary flags", () => {
      const wholeWord = buildSearchRegex("cat", false, true);
      assert.ok(wholeWord !== null);
      assert.equal(wholeWord.source, "\\bcat\\b");
      assert.equal(wholeWord.test("a black cat sat"), true);
      assert.equal(wholeWord.test("catch the ball"), false);
      assert.equal(wholeWord.test("scattered"), false);
    });
  });

  describe("2. findMatchesInDoc & Plugin State", () => {
    it("locates all occurrences of a search term in document", () => {
      const editor = createSearchEditor("<p>Hello world. Welcome to the world of notes.</p>");
      editor.commands.setSearchTerm("world");

      const state = searchAndReplacePluginKey.getState(editor.state);
      assert.ok(state !== null);
      assert.equal(state.results.length, 2);
      assert.equal(state.currentIndex, 0);

      editor.destroy();
    });

    it("honors case sensitivity in document matches", () => {
      const editor = createSearchEditor("<p>React is great. Learn react today. REACT native.</p>");
      editor.commands.setSearchTerm("react");
      editor.commands.setSearchOptions({ caseSensitive: true });

      const state = searchAndReplacePluginKey.getState(editor.state);
      assert.ok(state !== null);
      assert.equal(state.results.length, 1);

      // Turn case sensitivity off
      editor.commands.setSearchOptions({ caseSensitive: false });
      const updatedState = searchAndReplacePluginKey.getState(editor.state);
      assert.equal(updatedState.results.length, 3);

      editor.destroy();
    });

    it("honors whole-word option in document matches", () => {
      const editor = createSearchEditor("<p>The plan is to plant a tree in the planet.</p>");
      editor.commands.setSearchTerm("plan");
      editor.commands.setSearchOptions({ wholeWord: true });

      const state = searchAndReplacePluginKey.getState(editor.state);
      assert.ok(state !== null);
      assert.equal(state.results.length, 1);

      editor.destroy();
    });
  });

  describe("3. Match Navigation", () => {
    it("cycles forward with nextSearchResult and wraps to start", () => {
      const editor = createSearchEditor("<p>alpha beta alpha gamma alpha</p>");
      editor.commands.setSearchTerm("alpha");

      let state = searchAndReplacePluginKey.getState(editor.state);
      assert.equal(state.results.length, 3);
      assert.equal(state.currentIndex, 0);

      editor.commands.nextSearchResult();
      state = searchAndReplacePluginKey.getState(editor.state);
      assert.equal(state.currentIndex, 1);

      editor.commands.nextSearchResult();
      state = searchAndReplacePluginKey.getState(editor.state);
      assert.equal(state.currentIndex, 2);

      // Wraps around to 0
      editor.commands.nextSearchResult();
      state = searchAndReplacePluginKey.getState(editor.state);
      assert.equal(state.currentIndex, 0);

      editor.destroy();
    });

    it("cycles backward with previousSearchResult and wraps to end", () => {
      const editor = createSearchEditor("<p>alpha beta alpha gamma alpha</p>");
      editor.commands.setSearchTerm("alpha");

      let state = searchAndReplacePluginKey.getState(editor.state);
      assert.equal(state.currentIndex, 0);

      // Wraps back to last match (2)
      editor.commands.previousSearchResult();
      state = searchAndReplacePluginKey.getState(editor.state);
      assert.equal(state.currentIndex, 2);

      editor.commands.previousSearchResult();
      state = searchAndReplacePluginKey.getState(editor.state);
      assert.equal(state.currentIndex, 1);

      editor.destroy();
    });
  });

  describe("4. Replacement Operations", () => {
    it("replaces active match with replaceCurrent", () => {
      const editor = createSearchEditor("<p>one apple, two apples, three apples</p>");
      editor.commands.setSearchTerm("apple");
      editor.commands.setReplaceTerm("orange");

      // Replace first occurrence
      editor.commands.replaceCurrent();
      assert.equal(
        editor.getText(),
        "one orange, two apples, three apples"
      );

      // Match count should update from 3 to 2
      const state = searchAndReplacePluginKey.getState(editor.state);
      assert.equal(state.results.length, 2);

      editor.destroy();
    });

    it("replaces all occurrences throughout document with replaceAll", () => {
      const editor = createSearchEditor(
        "<p>KeNote is fast.</p><p>KeNote is minimal.</p><p>I love KeNote.</p>"
      );
      editor.commands.setSearchTerm("KeNote");
      editor.commands.setReplaceTerm("HyperNote");

      editor.commands.replaceAll();

      assert.equal(
        editor.getText(),
        "HyperNote is fast.\n\nHyperNote is minimal.\n\nI love HyperNote."
      );

      const state = searchAndReplacePluginKey.getState(editor.state);
      assert.equal(state.results.length, 0);

      editor.destroy();
    });

    it("clears search query and highlights with clearSearch", () => {
      const editor = createSearchEditor("<p>Find and replace test.</p>");
      editor.commands.setSearchTerm("test");

      let state = searchAndReplacePluginKey.getState(editor.state);
      assert.equal(state.results.length, 1);

      editor.commands.clearSearch();
      state = searchAndReplacePluginKey.getState(editor.state);
      assert.equal(state.searchTerm, "");
      assert.equal(state.results.length, 0);

      editor.destroy();
    });
  });
});
