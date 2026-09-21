import { test, describe } from "node:test";
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
const Paragraph = (await import("@tiptap/extension-paragraph")).default;

const lowlight = createLowlight(common);

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

function createTestEditor(initialContent = "") {
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
        transformPastedText: false,
        transformCopiedText: false,
      }),
    ],
    content: preserveBlankLines(initialContent),
  });
}

describe("Markdown Fidelity & Roundtrip Verification", () => {
  test("1. Preserves single empty lines (2 Enters)", () => {
    const input = "Paragraph 1\n\nParagraph 2";
    const ed = createTestEditor(input);
    const output = ed.storage.markdown.getMarkdown();
    assert.strictEqual(output, input);
    assert.strictEqual(output.includes("<br>"), false);
    assert.strictEqual(output.includes("\\"), false);
    ed.destroy();
  });

  test("2. Preserves multiple consecutive empty lines (3, 4, 5 Enters)", () => {
    const cases = [
      "Alpha\n\n\nBeta",
      "Alpha\n\n\n\nBeta",
      "Alpha\n\n\n\n\nBeta",
    ];
    for (const input of cases) {
      const ed1 = createTestEditor(input);
      const out1 = ed1.storage.markdown.getMarkdown();
      assert.strictEqual(out1, input);
      assert.strictEqual(out1.includes("<br>"), false);
      assert.strictEqual(out1.includes("\\"), false);

      // Multiple roundtrip cycles
      const ed2 = createTestEditor(out1);
      const out2 = ed2.storage.markdown.getMarkdown();
      assert.strictEqual(out2, input);
      ed1.destroy();
      ed2.destroy();
    }
  });

  test("3. Does not generate backslashes or <br> on repeated saves", () => {
    let content = "Heading Line\n\n\n\nBody Line 1\n\n\nBody Line 2";
    for (let cycle = 0; cycle < 5; cycle++) {
      const ed = createTestEditor(content);
      content = ed.storage.markdown.getMarkdown();
      assert.strictEqual(content.includes("<br>"), false, `Cycle ${cycle} injected <br>`);
      assert.strictEqual(content.includes("\\"), false, `Cycle ${cycle} injected \\`);
      ed.destroy();
    }
    assert.strictEqual(content, "Heading Line\n\n\n\nBody Line 1\n\n\nBody Line 2");
  });

  test("4. Preserves formatting across round-trips", () => {
    const sample = [
      "# Heading 1",
      "## Heading 2",
      "### Heading 3",
      "",
      "This is **bold**, *italic*, `code`, and [link](https://kenote.dev).",
      "",
      "> A blockquote here",
      "",
      "- Bullet 1",
      "- Bullet 2",
      "",
      "1. Ordered 1",
      "2. Ordered 2",
      "",
      "- [ ] Task incomplete",
      "- [x] Task complete",
    ].join("\n");

    const ed1 = createTestEditor(sample);
    const out1 = ed1.storage.markdown.getMarkdown();
    const ed2 = createTestEditor(out1);
    const out2 = ed2.storage.markdown.getMarkdown();

    assert.strictEqual(out1, out2);
    ed1.destroy();
    ed2.destroy();
  });

  test("5. Preserves legitimate markdown escaping without stripping or multiplying", () => {
    const escapes = "Special chars: \\*not bold\\*, \\[not a link\\], \\_not italic\\_, \\\\literal backslash";
    const ed = createTestEditor(escapes);
    const out = ed.storage.markdown.getMarkdown().trim();
    assert.strictEqual(out, escapes);
    ed.destroy();
  });

  test("6. Code blocks with blank lines inside are preserved unchanged", () => {
    const codeBlock = "```ts\nfunction test() {\n\n  const x = 1;\n\n  return x;\n}\n```";
    const ed = createTestEditor(codeBlock);
    const out = ed.storage.markdown.getMarkdown().trim();
    assert.strictEqual(out, codeBlock);
    ed.destroy();
  });
});
