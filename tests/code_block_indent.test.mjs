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

function dispatchKey(editor, key) {
  const event = new KeyboardEvent("keydown", { key });
  for (const plugin of editor.state.plugins) {
    if (plugin.props && plugin.props.handleKeyDown) {
      if (plugin.props.handleKeyDown(editor.view, event)) {
        return true;
      }
    }
  }
  return false;
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
    it("exits the code block when pressing Enter on a blank line at the end", () => {
      const editor = createTestEditor("<pre><code>x = 10\n</code></pre>");
      // Position cursor on the second line (which is empty)
      editor.commands.setTextSelection(8);

      const handled = dispatchKey(editor, "Enter");
      assert.equal(handled, true);
      // Editor should now have exited the code block into a paragraph
      assert.equal(editor.isActive("codeBlock"), false);
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

  describe("6. Arrow Key Navigation across Code Block Boundaries", () => {
    it("steps out to previous block or inserts paragraph on ArrowUp on first line", () => {
      const editor = createTestEditor("<p>Above</p><pre><code>let y = 20</code></pre>");
      // Position cursor on first line of code block
      editor.commands.setTextSelection(10);
      assert.equal(editor.isActive("codeBlock"), true);

      const handled = dispatchKey(editor, "ArrowUp");
      assert.equal(handled, true);
      assert.equal(editor.isActive("codeBlock"), false);
      editor.destroy();
    });

    it("steps out to next block or inserts paragraph on ArrowDown on last line", () => {
      const editor = createTestEditor("<pre><code>let y = 20</code></pre><p>Below</p>");
      // Position cursor on last line of code block
      editor.commands.setTextSelection(10);
      assert.equal(editor.isActive("codeBlock"), true);

      const handled = dispatchKey(editor, "ArrowDown");
      assert.equal(handled, true);
      assert.equal(editor.isActive("codeBlock"), false);
      editor.destroy();
    });

    it("steps out before code block on ArrowLeft at start", () => {
      const editor = createTestEditor("<p>Intro</p><pre><code>console.log()</code></pre>");
      // Place cursor at pos 1 of code block content (offset 0)
      editor.commands.setTextSelection(8);
      assert.equal(editor.isActive("codeBlock"), true);

      const handled = dispatchKey(editor, "ArrowLeft");
      assert.equal(handled, true);
      assert.equal(editor.isActive("codeBlock"), false);
      editor.destroy();
    });

    it("steps out after code block on ArrowRight at end", () => {
      const editor = createTestEditor("<pre><code>console.log()</code></pre><p>Outro</p>");
      // Place cursor at end of code block
      editor.commands.setTextSelection(14);
      assert.equal(editor.isActive("codeBlock"), true);

      const handled = dispatchKey(editor, "ArrowRight");
      assert.equal(handled, true);
      assert.equal(editor.isActive("codeBlock"), false);
      editor.destroy();
    });
  });
});
