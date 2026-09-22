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
globalThis.DOMParser = dom.window.DOMParser;
globalThis.requestAnimationFrame = (cb) => {
  try {
    cb(Date.now());
  } catch {}
  return 0;
};
globalThis.cancelAnimationFrame = () => {};

const StarterKit = (await import("@tiptap/starter-kit")).default;
const Underline = (await import("@tiptap/extension-underline")).default;
const Link = (await import("@tiptap/extension-link")).default;
const TaskList = (await import("@tiptap/extension-task-list")).default;
const TaskItem = (await import("@tiptap/extension-task-item")).default;
const CodeBlockLowlight = (await import("@tiptap/extension-code-block-lowlight")).default;
const { common, createLowlight } = await import("lowlight");
const { Markdown } = await import("tiptap-markdown");
const { Editor } = await import("@tiptap/core");
const { createSafeSelection } = await import("../src/utils/selection.ts");

const lowlight = createLowlight(common);

const Paragraph = (await import("@tiptap/extension-paragraph")).default;

function preserveBlankLines(md) {
  if (!md) return "";
  const parts = md.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part.replace(/(\r?\n){3,}/g, (match) => {
        const count = match.split(/\r?\n/).length - 1;
        const extraEmptyParagraphs = count - 2;
        const emptyTags = Array(extraEmptyParagraphs).fill("<p></p>").join("\n");
        return `\n\n${emptyTags}\n\n`;
      });
    })
    .join("");
}

const CustomParagraph = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          if (node.childCount === 0) {
            state.write("");
            state.closeBlock(node);
          } else {
            state.renderInline(node);
            state.closeBlock(node);
          }
        },
        parse: {},
      },
    };
  },
});

const CustomTaskList = TaskList.extend({
  addAttributes() {
    return {
      tight: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-tight") === "true" || !element.querySelector("p"),
        renderHTML: (attributes) => ({
          class: attributes.tight ? "tight" : null,
          "data-tight": attributes.tight ? "true" : null,
        }),
      },
    };
  },
});

const Bold = (await import("@tiptap/extension-bold")).default;
const Italic = (await import("@tiptap/extension-italic")).default;
const {
  toggleSmartBold,
  toggleSmartItalic,
  toggleSmartUnderline,
} = await import("../src/utils/formatting.ts");

const CustomBold = Bold.extend({
  addKeyboardShortcuts() {
    return {
      "Mod-b": () => toggleSmartBold(this.editor),
      "Mod-B": () => toggleSmartBold(this.editor),
    };
  },
});

const CustomItalic = Italic.extend({
  addKeyboardShortcuts() {
    return {
      "Mod-i": () => toggleSmartItalic(this.editor),
      "Mod-I": () => toggleSmartItalic(this.editor),
    };
  },
});

const CustomUnderline = Underline.extend({
  addKeyboardShortcuts() {
    return {
      "Mod-u": () => toggleSmartUnderline(this.editor),
      "Mod-U": () => toggleSmartUnderline(this.editor),
    };
  },
});

function createTestEditor(content = "") {
  return new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        paragraph: false,
        bold: false,
        italic: false,
      }),
      CustomParagraph,
      CustomBold,
      CustomItalic,
      CustomUnderline,
      CodeBlockLowlight.configure({ lowlight }),
      CustomTaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Markdown.configure({
        html: true,
        transformPastedText: false,
        transformCopiedText: false,
      }),
    ],
    content: preserveBlankLines(content),
  });
}

describe("Editor Markdown Roundtrip Tests", () => {
  test("preserves bold formatting", () => {
    const md = "**Bold text**";
    const ed = createTestEditor(md);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), md);
    ed.destroy();
  });

  test("preserves italic formatting", () => {
    const md = "*Italic text*";
    const ed = createTestEditor(md);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), md);
    ed.destroy();
  });

  test("preserves headings", () => {
    const md = "# Heading 1\n\n## Heading 2\n\n### Heading 3";
    const ed = createTestEditor(md);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), md);
    ed.destroy();
  });

  test("preserves bullet lists", () => {
    const md = "- Item A\n- Item B\n- Item C";
    const ed = createTestEditor(md);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), md);
    ed.destroy();
  });

  test("preserves ordered lists", () => {
    const md = "1. First\n2. Second\n3. Third";
    const ed = createTestEditor(md);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), md);
    ed.destroy();
  });

  test("preserves task lists", () => {
    const md = "- [ ] Pending task\n- [x] Completed task";
    const ed = createTestEditor(md);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), md);
    ed.destroy();
  });

  test("preserves inline code and code blocks", () => {
    const md = "Here is `code`\n\n```\nconst x = 42;\n```";
    const ed = createTestEditor(md);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), md);
    ed.destroy();
  });

  test("preserves links", () => {
    const md = "[KeNote](https://kenote.dev)";
    const ed = createTestEditor(md);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), md);
    ed.destroy();
  });

  test("checks underline formatting round-trip", () => {
    const md = "<u>Underlined</u>";
    const ed = createTestEditor(md);
    const output = ed.storage.markdown.getMarkdown().trim();
    assert.strictEqual(output, md);
    ed.destroy();
  });

  test("checks empty paragraph node serialization", () => {
    const ed = createTestEditor();
    ed.commands.setContent("<p>Line 1</p><p></p><p>Line 2</p>");
    const md = ed.storage.markdown.getMarkdown();
    assert.strictEqual(md, "Line 1\n\n\nLine 2");
    assert.strictEqual(md.includes("<br>"), false);
    assert.strictEqual(md.includes("\\"), false);
    ed.destroy();
  });

  test("preserves multiple consecutive newlines without backslashes or br tags", () => {
    const testCases = [
      "Line 1\n\nLine 2",
      "Line 1\n\n\nLine 2",
      "Line 1\n\n\n\nLine 2",
      "Line 1\n\n\n\n\nLine 2",
    ];
    for (const input of testCases) {
      const ed = createTestEditor(input);
      const output = ed.storage.markdown.getMarkdown();
      assert.strictEqual(output, input, `Expected ${JSON.stringify(input)} to equal ${JSON.stringify(output)}`);
      assert.strictEqual(output.includes("<br>"), false);
      assert.strictEqual(output.includes("\\"), false);
      ed.destroy();
    }
  });

  test("preserves legitimate markdown escapes without corrupting them", () => {
    const input = "Escaped \\*asterisk\\* and \\[brackets\\] and \\_underscore\\_";
    const ed = createTestEditor(input);
    const output = ed.storage.markdown.getMarkdown().trim();
    assert.strictEqual(output, input);
    ed.destroy();
  });

  test("security check: scripts, iframes, and onerror handlers", () => {
    const malicious = "<script>alert(1)</script><iframe src='https://evil.com'></iframe><img src=x onerror=alert(1)>Hello <b>world</b>";
    const ed = createTestEditor(malicious);
    const html = ed.getHTML();
    const md = ed.storage.markdown.getMarkdown();
    assert.strictEqual(html.includes("<script"), false, "Must not contain script tags");
    assert.strictEqual(html.includes("<iframe"), false, "Must not contain iframe tags");
    assert.strictEqual(html.includes("onerror"), false, "Must not contain onerror handlers");
    ed.destroy();
  });

  test("toggleSmartBold bolds and un-bolds word when cursor is inside", () => {
    const ed = createTestEditor("hello world");
    // Position cursor inside "world"
    ed.commands.setTextSelection(9);

    toggleSmartBold(ed);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), "hello **world**");

    // Repeated toggle un-bolds the word
    toggleSmartBold(ed);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), "hello world");
    ed.destroy();
  });

  test("toggleSmartItalic italicizes and un-italicizes word when cursor is inside", () => {
    const ed = createTestEditor("hello world");
    ed.commands.setTextSelection(9);

    toggleSmartItalic(ed);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), "hello *world*");

    // Repeated toggle un-italicizes the word
    toggleSmartItalic(ed);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), "hello world");
    ed.destroy();
  });

  test("toggleSmartUnderline underlines and un-underlines word when cursor is inside", () => {
    const ed = createTestEditor("hello world");
    ed.commands.setTextSelection(9);

    toggleSmartUnderline(ed);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), "hello <u>world</u>");

    // Repeated toggle un-underlines the word
    toggleSmartUnderline(ed);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), "hello world");
    ed.destroy();
  });

  test("explicit text selection applies marks to selection range without word expansion", () => {
    const ed = createTestEditor("hello beautiful world");
    // Select "beautiful" (from pos 7 to pos 16)
    ed.commands.setTextSelection({ from: 7, to: 16 });

    toggleSmartItalic(ed);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), "hello *beautiful* world");

    toggleSmartBold(ed);
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), "hello ***beautiful*** world");
    ed.destroy();
  });

  test("collapsed cursor outside a word preserves normal mark toggle for subsequent typing", () => {
    const ed = createTestEditor("");
    // Cursor in empty paragraph
    ed.commands.setTextSelection(1);

    toggleSmartBold(ed);
    ed.commands.insertContent("world");
    assert.strictEqual(ed.storage.markdown.getMarkdown().trim(), "**world**");
    ed.destroy();
  });
});

describe("Editor Cursor & Selection Regression Tests", () => {
  test("places cursor accurately inside normal paragraphs without deviation", () => {
    const ed = createTestEditor("Line 1\n\nLine 2\n\nLine 3");
    const doc = ed.state.doc;
    let line3Pos = null;
    doc.descendants((node, pos) => {
      if (node.isText && node.text.includes("Line 3")) {
        line3Pos = pos + 2; // inside "Line 3"
      }
    });
    assert.ok(line3Pos !== null, "Line 3 position must exist");
    const safeSel = createSafeSelection(doc, line3Pos, line3Pos);
    assert.ok(safeSel);
    ed.view.dispatch(ed.state.tr.setSelection(safeSel));
    assert.strictEqual(ed.state.selection.from, line3Pos);
    assert.strictEqual(ed.state.selection.$from.parent.inlineContent, true);
    ed.destroy();
  });

  test("places cursor accurately inside task items without warning or non-inline endpoints", () => {
    const ed = createTestEditor("- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3");
    const doc = ed.state.doc;
    let task3Pos = null;
    doc.descendants((node, pos) => {
      if (node.isText && node.text.includes("Task 3")) {
        task3Pos = pos + 3;
      }
    });
    assert.ok(task3Pos !== null, "Task 3 position must exist");
    const safeSel = createSafeSelection(doc, task3Pos, task3Pos);
    assert.ok(safeSel);
    ed.view.dispatch(ed.state.tr.setSelection(safeSel));
    assert.strictEqual(ed.state.selection.from, task3Pos);
    assert.strictEqual(ed.state.selection.$from.parent.type.name, "paragraph");
    assert.strictEqual(ed.state.selection.$from.parent.inlineContent, true);
    ed.destroy();
  });

  test("switching between notes containing task lists safely restores valid cursor positions", () => {
    const ed = createTestEditor("- [ ] Note 1 Item 1\n- [ ] Note 1 Item 2");
    // Save cursor position in Note 1
    const note1Pos = ed.state.doc.content.size - 2;
    const safeNote1Sel = createSafeSelection(ed.state.doc, note1Pos);
    ed.view.dispatch(ed.state.tr.setSelection(safeNote1Sel));
    const savedNote1Cursor = ed.state.selection.from;

    // Switch to Note 2 with different task items
    ed.commands.setContent("- [ ] Note 2 Alpha\n- [ ] Note 2 Beta\n- [ ] Note 2 Gamma", false);
    const note2Sel = createSafeSelection(ed.state.doc, 5);
    ed.view.dispatch(ed.state.tr.setSelection(note2Sel));
    assert.strictEqual(ed.state.selection.$from.parent.inlineContent, true);

    // Switch back to Note 1 and restore saved cursor safely
    ed.commands.setContent("- [ ] Note 1 Item 1\n- [ ] Note 1 Item 2", false);
    const restoredNote1Sel = createSafeSelection(ed.state.doc, savedNote1Cursor);
    ed.view.dispatch(ed.state.tr.setSelection(restoredNote1Sel));
    assert.strictEqual(ed.state.selection.from, savedNote1Cursor);
    assert.strictEqual(ed.state.selection.$from.parent.inlineContent, true);
    ed.destroy();
  });

  test("safely clamps and resolves invalid or block-boundary cursor positions (taskItem/doc boundary)", () => {
    const ed = createTestEditor("- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3");
    const doc = ed.state.doc;
    // Pos 10 is taskItem boundary (non-inline content). In previous code, setTextSelection(10) triggered console.warn
    const safeSel10 = createSafeSelection(doc, 10);
    assert.ok(safeSel10);
    assert.strictEqual(safeSel10.$from.parent.inlineContent, true, "Endpoint must point into inline content");
    assert.strictEqual(safeSel10.$from.parent.type.name, "paragraph");

    // Test extreme out-of-bounds pos 9999
    const safeSelOutOfBounds = createSafeSelection(doc, 9999);
    assert.ok(safeSelOutOfBounds);
    assert.strictEqual(safeSelOutOfBounds.$from.parent.inlineContent, true);
    assert.strictEqual(safeSelOutOfBounds.from <= doc.content.size, true);

    // Test pos 0 (before doc)
    const safeSelZero = createSafeSelection(doc, 0);
    assert.ok(safeSelZero);
    assert.strictEqual(safeSelZero.$from.parent.inlineContent, true);

    ed.destroy();
  });

  test("synchronous note content switching guarantees user selection is not overwritten by stale RAF", () => {
    const ed = createTestEditor("Line 1\n\nLine 2\n\nLine 3");
    const cursorPositions = { "note-1": { from: 1, to: 1 }, "note-2": { from: 2, to: 2 } };

    // Switch to Note 2 synchronously
    ed.commands.setContent("Note 2 Line 1\n\nNote 2 Line 2\n\nNote 2 Line 3", false);
    // Synchronous restore runs immediately
    const safeSel = createSafeSelection(ed.state.doc, cursorPositions["note-2"].from);
    ed.view.dispatch(ed.state.tr.setSelection(safeSel));

    // User immediately clicks Line 3 (pos 25)
    const userClickPos = ed.state.doc.content.size - 2;
    const userClickSel = createSafeSelection(ed.state.doc, userClickPos);
    ed.view.dispatch(ed.state.tr.setSelection(userClickSel));

    // Verify user's selection remains on Line 3
    assert.strictEqual(ed.state.selection.from, userClickPos);
    assert.strictEqual(ed.state.selection.$from.parent.inlineContent, true);
    ed.destroy();
  });

  test("allows normal typing and text insertion after clicking a line", () => {
    const ed = createTestEditor("First line\n\nSecond line\n\nThird line");
    // Simulate clicking the third line:
    let thirdLineDocPos = null;
    ed.state.doc.descendants((node, pos) => {
      if (node.isText && node.text.includes("Third line")) {
        thirdLineDocPos = pos + node.text.length; // end of third line
      }
    });
    assert.ok(thirdLineDocPos !== null);

    const clickSel = createSafeSelection(ed.state.doc, thirdLineDocPos);
    ed.view.dispatch(ed.state.tr.setSelection(clickSel));

    // Type " appended" at cursor
    ed.commands.insertContent(" appended");

    const updatedMd = ed.storage.markdown.getMarkdown();
    assert.ok(updatedMd.includes("Third line appended"), `Expected "Third line appended" in: ${updatedMd}`);
    assert.ok(updatedMd.startsWith("First line"));
    ed.destroy();
  });
});

const { computeDocumentStats } = await import("../src/utils/documentStats.ts");

describe("Document Statistics & Count Tests", () => {

  test("calculates empty document stats correctly", () => {
    const emptyStats = computeDocumentStats("");
    assert.strictEqual(emptyStats.charCount, 0);
    assert.strictEqual(emptyStats.wordCount, 0);
    assert.strictEqual(emptyStats.firstLineTitle, "Untitled");

    const nullStats = computeDocumentStats(null);
    assert.strictEqual(nullStats.charCount, 0);
    assert.strictEqual(nullStats.wordCount, 0);
    assert.strictEqual(nullStats.firstLineTitle, "Untitled");
  });

  test("calculates whitespace-only document stats correctly", () => {
    const wsStats = computeDocumentStats("   \n\n\t  \r\n   ");
    assert.strictEqual(wsStats.charCount, 13);
    assert.strictEqual(wsStats.wordCount, 0);
    assert.strictEqual(wsStats.firstLineTitle, "Untitled");
  });

  test("calculates words and characters accurately across multiple spaces and newlines", () => {
    const text = "Hello   world!\n\nThis is\ta   test.\n";
    const stats = computeDocumentStats(text);
    assert.strictEqual(stats.charCount, text.length);
    assert.strictEqual(stats.wordCount, 6);
    assert.strictEqual(stats.firstLineTitle, "Hello   world!");
  });

  test("extracts firstLineTitle cleanly ignoring leading/trailing blank lines", () => {
    const text = "\n\nActual First Line\nSecond Line";
    const stats = computeDocumentStats(text);
    assert.strictEqual(stats.firstLineTitle, "Actual First Line");
    assert.strictEqual(stats.wordCount, 5);
  });

  test("matches editor doc.textContent during live typing and content updates", () => {
    const ed = createTestEditor("The quick brown fox jumps over the lazy dog.");
    const text = ed.state.doc.textContent;
    const stats = computeDocumentStats(text);
    assert.strictEqual(stats.charCount, 44);
    assert.strictEqual(stats.wordCount, 9);
    assert.strictEqual(stats.firstLineTitle, "The quick brown fox jumps over the lazy dog.");

    // Insert more words at the end of the document
    ed.commands.setTextSelection(ed.state.doc.content.size - 1);
    ed.commands.insertContent(" And another line.");
    const updatedText = ed.state.doc.textContent;
    const updatedStats = computeDocumentStats(updatedText);
    assert.strictEqual(updatedStats.wordCount, 12);
    ed.destroy();
  });
});
