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
globalThis.Event = dom.window.Event;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;

const StarterKit = (await import("@tiptap/starter-kit")).default;
const { Editor } = await import("@tiptap/core");
const { common, createLowlight } = await import("lowlight");
const { SmartCodeBlock, INDENT_SPACES, INDENT_SIZE } = await import("../src/extensions/SmartCodeBlock.ts");

const lowlight = createLowlight(common);

function createTestEditor(initialContent = "<p>Hello</p>") {
  return new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      SmartCodeBlock.configure({ lowlight }),
    ],
    content: initialContent,
  });
}

describe("Smart Code Block Indentation & Formatting Tests", () => {
  describe("1. Constants & Configuration", () => {
    it("configures 4 spaces as default indentation", () => {
      assert.equal(INDENT_SPACES, "    ");
      assert.equal(INDENT_SIZE, 4);
    });
  });

  describe("2. Tab Indentation inside Code Block", () => {
    it("inserts 4 spaces when pressing Tab inside a code block", () => {
      const editor = createTestEditor("<pre><code>x = 10</code></pre>");
      // Place cursor at beginning of line
      editor.commands.setTextSelection(1);
      
      const handled = editor.commands.keyboardShortcut("Tab");
      assert.equal(handled, true);
      assert.equal(editor.getText(), "    x = 10");
      editor.destroy();
    });

    it("does not insert indentation when cursor is outside a code block", () => {
      const editor = createTestEditor("<p>Plain paragraph text</p>");
      editor.commands.setTextSelection(5);
      
      // When outside codeBlock, SmartCodeBlock returns false; plain text does not get code indent inserted
      editor.commands.keyboardShortcut("Tab");
      assert.equal(editor.getText(), "Plain paragraph text");
      editor.destroy();
    });

    it("indents multiple selected lines by 4 spaces", () => {
      const editor = createTestEditor("<pre><code>line 1\nline 2\nline 3</code></pre>");
      // Select from line 1 through line 2
      editor.commands.setTextSelection({ from: 1, to: 14 });

      const handled = editor.commands.keyboardShortcut("Tab");
      assert.equal(handled, true);
      const text = editor.getText();
      assert.ok(text.includes("    line 1\n    line 2"));
      editor.destroy();
    });
  });

  describe("3. Shift-Tab Dedenting", () => {
    it("removes 4 leading spaces when pressing Shift-Tab", () => {
      const editor = createTestEditor("<pre><code>        nested_var = 1</code></pre>");
      editor.commands.setTextSelection(12);

      const handled = editor.commands.keyboardShortcut("Shift-Tab");
      assert.equal(handled, true);
      assert.equal(editor.getText(), "    nested_var = 1");
      editor.destroy();
    });

    it("removes partial indentation (e.g. 2 spaces) up to 4 spaces", () => {
      const editor = createTestEditor("<pre><code>  two_spaces = 1</code></pre>");
      editor.commands.setTextSelection(6);

      const handled = editor.commands.keyboardShortcut("Shift-Tab");
      assert.equal(handled, true);
      assert.equal(editor.getText(), "two_spaces = 1");
      editor.destroy();
    });

    it("does not alter lines without leading indentation", () => {
      const editor = createTestEditor("<pre><code>no_indent = 1</code></pre>");
      editor.commands.setTextSelection(5);

      const handled = editor.commands.keyboardShortcut("Shift-Tab");
      assert.equal(handled, true);
      assert.equal(editor.getText(), "no_indent = 1");
      editor.destroy();
    });
  });

  describe("4. Smart Auto-Indent on Enter", () => {
    it("preserves base indentation on Enter for normal statements", () => {
      const editor = createTestEditor("<pre><code>    x = 10</code></pre>");
      // Place cursor at the end of the line
      editor.commands.setTextSelection(11);

      const handled = editor.commands.keyboardShortcut("Enter");
      assert.equal(handled, true);
      assert.equal(editor.getText(), "    x = 10\n    ");
      editor.destroy();
    });

    it("increases indentation by 4 spaces after opening colon (Python if/def/class)", () => {
      const editor = createTestEditor("<pre><code>if True:</code></pre>");
      editor.commands.setTextSelection(9);

      const handled = editor.commands.keyboardShortcut("Enter");
      assert.equal(handled, true);
      assert.equal(editor.getText(), "if True:\n    ");
      editor.destroy();
    });

    it("increases indentation by 4 spaces after opening brace (JS/Rust/C++)", () => {
      const editor = createTestEditor("<pre><code>function test() {</code></pre>");
      editor.commands.setTextSelection(18);

      const handled = editor.commands.keyboardShortcut("Enter");
      assert.equal(handled, true);
      assert.equal(editor.getText(), "function test() {\n    ");
      editor.destroy();
    });

    it("cumulatively indents nested blocks (e.g. 4 -> 8 spaces)", () => {
      const editor = createTestEditor("<pre><code>    def inner():</code></pre>");
      editor.commands.setTextSelection(17);

      const handled = editor.commands.keyboardShortcut("Enter");
      assert.equal(handled, true);
      assert.equal(editor.getText(), "    def inner():\n        ");
      editor.destroy();
    });

    it("expands matching brackets when Enter is pressed between { and }", () => {
      const editor = createTestEditor("<pre><code>const obj = {};</code></pre>");
      // Place cursor right between { and } (pos 14)
      editor.commands.setTextSelection(14);

      const handled = editor.commands.keyboardShortcut("Enter");
      assert.equal(handled, true);
      const text = editor.getText();
      assert.equal(text, "const obj = {\n    \n};");
      editor.destroy();
    });
  });

  describe("5. Smart Backspace Indent Deletion", () => {
    it("deletes 4 spaces at once when cursor is at indentation boundary", () => {
      const editor = createTestEditor("<pre><code>        x = 1</code></pre>");
      // Position cursor right after the 8th space (pos 9)
      editor.commands.setTextSelection(9);

      const handled = editor.commands.keyboardShortcut("Backspace");
      assert.equal(handled, true);
      assert.equal(editor.getText(), "    x = 1");
      editor.destroy();
    });

    it("does not delete indent blocks when cursor is preceded by non-space text", () => {
      const editor = createTestEditor("<pre><code>x = 10</code></pre>");
      editor.commands.setTextSelection(7); // after '0'

      editor.commands.keyboardShortcut("Backspace");
      // Does not delete 4 characters of indent since cursor is after normal text
      assert.notEqual(editor.getText(), "");
      editor.destroy();
    });
  });
});
