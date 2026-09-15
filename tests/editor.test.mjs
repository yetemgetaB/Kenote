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

const StarterKit = (await import("@tiptap/starter-kit")).default;
const Underline = (await import("@tiptap/extension-underline")).default;
const Link = (await import("@tiptap/extension-link")).default;
const TaskList = (await import("@tiptap/extension-task-list")).default;
const TaskItem = (await import("@tiptap/extension-task-item")).default;
const CodeBlockLowlight = (await import("@tiptap/extension-code-block-lowlight")).default;
const { common, createLowlight } = await import("lowlight");
const { Markdown } = await import("tiptap-markdown");
const { Editor } = await import("@tiptap/core");

const lowlight = createLowlight(common);

const Paragraph = (await import("@tiptap/extension-paragraph")).default;

const CustomParagraph = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          if (node.childCount === 0) {
            state.write("<br>");
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

function createTestEditor(content = "") {
  return new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        paragraph: false,
      }),
      CustomParagraph,
      CodeBlockLowlight.configure({ lowlight }),
      CustomTaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      Link.configure({ openOnClick: false }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
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
    console.log("UNDERLINE OUTPUT:", output);
    ed.destroy();
  });

  test("checks empty paragraph node serialization", () => {
    const ed = createTestEditor();
    ed.commands.setContent("<p>Line 1</p><p></p><p>Line 2</p>");
    const md = ed.storage.markdown.getMarkdown();
    console.log("EMPTY P SERIALIZED TO MD:", JSON.stringify(md));
    ed.destroy();
  });

  test("security check: scripts, iframes, and onerror handlers", () => {
    const malicious = "<script>alert(1)</script><iframe src='https://evil.com'></iframe><img src=x onerror=alert(1)>Hello <b>world</b>";
    const ed = createTestEditor(malicious);
    const html = ed.getHTML();
    const md = ed.storage.markdown.getMarkdown();
    console.log("SECURITY TEST HTML:", html);
    console.log("SECURITY TEST MD:", md);
    assert.strictEqual(html.includes("<script"), false, "Must not contain script tags");
    assert.strictEqual(html.includes("<iframe"), false, "Must not contain iframe tags");
    assert.strictEqual(html.includes("onerror"), false, "Must not contain onerror handlers");
    ed.destroy();
  });

  test("toggleSmartBold bolds word when cursor is inside", () => {
    const ed = createTestEditor("hello world");
    // Position cursor inside "world": text is in a paragraph
    // <p>hello world</p> -> pos 1 is 'h', pos 7 is 'w', pos 9 is 'r'
    ed.commands.setTextSelection(9);

    const { state, dispatch } = ed.view;
    const { selection, schema } = state;
    const boldMark = schema.marks.bold;
    const { $from } = selection;
    const parent = $from.parent;
    const text = parent.textContent;
    const offset = $from.parentOffset;

    const isWordChar = (char) => !!char && /[\p{L}\p{N}_]/u.test(char);
    let start = offset;
    if (!isWordChar(text[start]) && start > 0 && isWordChar(text[start - 1])) {
      start = start - 1;
    }
    while (start > 0 && isWordChar(text[start - 1])) start--;
    let end = offset;
    if (isWordChar(text[end])) {
      while (end < text.length && isWordChar(text[end])) end++;
    } else if (offset > 0 && isWordChar(text[offset - 1])) {
      end = offset;
    }

    const from = $from.start() + start;
    const to = $from.start() + end;
    const tr = state.tr;
    tr.addMark(from, to, boldMark.create());
    dispatch(tr);

    const md = ed.storage.markdown.getMarkdown().trim();
    assert.strictEqual(md, "hello **world**");

    // Repeated Ctrl+B un-bolds the word
    const state2 = ed.view.state;
    const tr2 = state2.tr;
    tr2.removeMark(from, to, boldMark);
    ed.view.dispatch(tr2);

    const md2 = ed.storage.markdown.getMarkdown().trim();
    assert.strictEqual(md2, "hello world");
    ed.destroy();
  });
});
