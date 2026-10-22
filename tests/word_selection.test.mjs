import { test, describe } from "node:test";
import assert from "node:assert";
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
const { findWordRangeAtPos } = await import("../src/utils/wordSelection.ts");

describe("Word Boundary Selection (findWordRangeAtPos)", () => {
  test("finds word when clicking in the middle of a word", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: "<p>Hello world from Kenote</p>",
    });

    // In "<p>Hello world from Kenote</p>":
    // Pos 1 to 6 is "Hello", pos 7 to 12 is "world"
    const result = findWordRangeAtPos(editor.state.doc, 9);
    assert.ok(result);
    assert.strictEqual(result.word, "world");
    assert.strictEqual(result.from, 7);
    assert.strictEqual(result.to, 12);
    editor.destroy();
  });

  test("finds word with contraction (e.g. don't)", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: "<p>We don't know yet</p>",
    });

    // "We" is 1-3, space is 3-4, "don't" is 4-9
    const result = findWordRangeAtPos(editor.state.doc, 6);
    assert.ok(result);
    assert.strictEqual(result.word, "don't");
    assert.strictEqual(result.from, 4);
    assert.strictEqual(result.to, 9);
    editor.destroy();
  });

  test("strips surrounding quotes and brackets", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: '<p>The ("important") note</p>',
    });

    // Inside "important"
    const pos = editor.state.doc.textContent.indexOf("important") + 1; // +1 for <p> tag
    const result = findWordRangeAtPos(editor.state.doc, pos + 2);
    assert.ok(result);
    assert.strictEqual(result.word, "important");
    editor.destroy();
  });

  test("returns null when clicking on an empty line or purely whitespace", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: "<p></p>",
    });

    const result = findWordRangeAtPos(editor.state.doc, 1);
    assert.strictEqual(result, null);
    editor.destroy();
  });

  test("returns null when clicking between multiple spaces", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: "<p>Hello&nbsp;&nbsp;&nbsp;&nbsp;world</p>",
    });

    // In "<p>Hello\u00a0\u00a0\u00a0\u00a0world</p>":
    // Pos 1 to 6: Hello
    // Pos 8 is right in the middle of the spaces
    const result = findWordRangeAtPos(editor.state.doc, 8);
    assert.strictEqual(result, null);
    editor.destroy();
  });

  test("finds word in formatted text (e.g. bold)", () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: "<p>Quick <strong>brown</strong> fox</p>",
    });

    const pos = editor.state.doc.textContent.indexOf("brown") + 1;
    const result = findWordRangeAtPos(editor.state.doc, pos + 1);
    assert.ok(result);
    assert.strictEqual(result.word, "brown");
    editor.destroy();
  });
});
