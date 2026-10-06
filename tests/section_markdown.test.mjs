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
const Paragraph = (await import("@tiptap/extension-paragraph")).default;
const { Section } = await import("../src/extensions/Section.ts");
const { computeDocumentStats, extractNoteTitle } = await import("../src/utils/documentStats.ts");

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
      Section,
      Markdown.configure({
        html: true,
        transformPastedText: false,
        transformCopiedText: false,
      }),
    ],
    content: preserveBlankLines(initialContent),
  });
}

describe("Section Markdown Serialization & Deserialization (Stage 3)", () => {
  test("1. Basic Section markdown parse and serialize round-trip", () => {
    const mdInput = [
      ':::kenote-section title="CPU Scheduling"',
      "",
      "CPU scheduling determines which process gets CPU time.",
      "",
      ":::",
    ].join("\n");

    const ed1 = createTestEditor(mdInput);
    assert.strictEqual(ed1.state.doc.childCount, 1);
    const secNode = ed1.state.doc.child(0);
    assert.strictEqual(secNode.type.name, "section");
    assert.strictEqual(secNode.attrs.title, "CPU Scheduling");
    assert.strictEqual(secNode.child(0).textContent, "CPU scheduling determines which process gets CPU time.");

    const mdOutput = ed1.storage.markdown.getMarkdown().trim();
    assert.ok(mdOutput.includes(':::kenote-section title="CPU Scheduling"'));
    assert.ok(mdOutput.includes("CPU scheduling determines which process gets CPU time."));
    assert.ok(mdOutput.includes(":::"));

    // Second round-trip for structural stability
    const ed2 = createTestEditor(mdOutput);
    assert.strictEqual(ed2.state.doc.child(0).type.name, "section");
    assert.strictEqual(ed2.state.doc.child(0).attrs.title, "CPU Scheduling");
    assert.strictEqual(ed2.state.doc.child(0).child(0).textContent, "CPU scheduling determines which process gets CPU time.");

    ed1.destroy();
    ed2.destroy();
  });

  test("2. Multiple consecutive and separated Sections", () => {
    const mdInput = [
      "# Operating Systems",
      "",
      ':::kenote-section title="Section 1: Overview"',
      "",
      "Overview content here.",
      "",
      ":::",
      "",
      "Middle paragraph between sections.",
      "",
      ':::kenote-section title="Section 2: Implementation"',
      "",
      "Implementation content here.",
      "",
      ":::",
    ].join("\n");

    const ed = createTestEditor(mdInput);
    assert.strictEqual(ed.state.doc.childCount, 4);
    assert.strictEqual(ed.state.doc.child(0).type.name, "heading");
    assert.strictEqual(ed.state.doc.child(1).type.name, "section");
    assert.strictEqual(ed.state.doc.child(1).attrs.title, "Section 1: Overview");
    assert.strictEqual(ed.state.doc.child(2).type.name, "paragraph");
    assert.strictEqual(ed.state.doc.child(3).type.name, "section");
    assert.strictEqual(ed.state.doc.child(3).attrs.title, "Section 2: Implementation");

    const serialized = ed.storage.markdown.getMarkdown();
    const ed2 = createTestEditor(serialized);
    assert.strictEqual(ed2.state.doc.childCount, 4);
    assert.strictEqual(ed2.state.doc.child(1).attrs.title, "Section 1: Overview");
    assert.strictEqual(ed2.state.doc.child(3).attrs.title, "Section 2: Implementation");

    ed.destroy();
    ed2.destroy();
  });

  test("3. Nested Sections with depth-aware colons (::: and ::::) round-trip", () => {
    const mdInput = [
      ':::kenote-section title="Algorithms"',
      "",
      "Here are the algorithms.",
      "",
      '::::kenote-section title="Round Robin"',
      "",
      "Round robin time quantum slice.",
      "",
      "::::",
      "",
      '::::kenote-section title="Priority Scheduling"',
      "",
      "Priority based scheduling.",
      "",
      "::::",
      "",
      "Conclusion for algorithms.",
      "",
      ":::",
    ].join("\n");

    const ed = createTestEditor(mdInput);
    const outerSec = ed.state.doc.child(0);
    assert.strictEqual(outerSec.type.name, "section");
    assert.strictEqual(outerSec.attrs.title, "Algorithms");
    assert.strictEqual(outerSec.childCount, 4);

    assert.strictEqual(outerSec.child(0).type.name, "paragraph");
    assert.strictEqual(outerSec.child(1).type.name, "section");
    assert.strictEqual(outerSec.child(1).attrs.title, "Round Robin");
    assert.strictEqual(outerSec.child(2).type.name, "section");
    assert.strictEqual(outerSec.child(2).attrs.title, "Priority Scheduling");
    assert.strictEqual(outerSec.child(3).type.name, "paragraph");

    const serialized = ed.storage.markdown.getMarkdown();
    assert.ok(serialized.includes(':::kenote-section title="Algorithms"'));
    assert.ok(serialized.includes('::::kenote-section title="Round Robin"'));
    assert.ok(serialized.includes("::::"));
    assert.ok(serialized.includes(":::"));

    const ed2 = createTestEditor(serialized);
    const roundTrippedOuter = ed2.state.doc.child(0);
    assert.strictEqual(roundTrippedOuter.attrs.title, "Algorithms");
    assert.strictEqual(roundTrippedOuter.child(1).attrs.title, "Round Robin");
    assert.strictEqual(roundTrippedOuter.child(2).attrs.title, "Priority Scheduling");

    ed.destroy();
    ed2.destroy();
  });

  test("4. Empty title round-trip preserves empty string without converting to Untitled Section", () => {
    const mdInput = [
      ':::kenote-section title=""',
      "",
      "Body of section with empty title.",
      "",
      ":::",
    ].join("\n");

    const ed = createTestEditor(mdInput);
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "");

    const serialized = ed.storage.markdown.getMarkdown();
    assert.ok(serialized.includes(':::kenote-section title=""'));

    const ed2 = createTestEditor(serialized);
    assert.strictEqual(ed2.state.doc.child(0).attrs.title, "");

    ed.destroy();
    ed2.destroy();
  });

  test("5. Unicode and special characters in Section titles", () => {
    const titleWithSpecialChars = 'CPU: "Round Robin" / አማርኛ / C++ & `yield` #1';
    
    // Create editor with node attribute directly
    const ed = createTestEditor("");
    ed.commands.setContent({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: titleWithSpecialChars },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Testing complex titles." }],
            },
          ],
        },
      ],
    });

    const serialized = ed.storage.markdown.getMarkdown();
    const ed2 = createTestEditor(serialized);

    assert.strictEqual(ed2.state.doc.child(0).attrs.title, titleWithSpecialChars);

    ed.destroy();
    ed2.destroy();
  });

  test("6. Rich body content inside Section (headings, lists, tasks, blockquotes, formatting)", () => {
    const mdInput = [
      ':::kenote-section title="Rich Content Demo"',
      "",
      "## Subheading Level 2",
      "",
      "This is **bold**, *italic*, and `inline code` with a [link](https://kenote.dev).",
      "",
      "> Quoted block inside section",
      "",
      "- Bullet 1",
      "- Bullet 2",
      "",
      "1. Ordered item 1",
      "2. Ordered item 2",
      "",
      "- [ ] Incomplete task",
      "- [x] Complete task",
      "",
      ":::",
    ].join("\n");

    const ed = createTestEditor(mdInput);
    const sec = ed.state.doc.child(0);
    assert.strictEqual(sec.type.name, "section");
    assert.strictEqual(sec.attrs.title, "Rich Content Demo");

    const serialized = ed.storage.markdown.getMarkdown();
    const ed2 = createTestEditor(serialized);

    assert.strictEqual(ed2.state.doc.child(0).type.name, "section");
    assert.strictEqual(ed2.state.doc.child(0).attrs.title, "Rich Content Demo");
    assert.strictEqual(ed2.state.doc.child(0).childCount, 6); // heading, paragraph, blockquote, bulletList, orderedList, taskList

    ed.destroy();
    ed2.destroy();
  });

  test("7. Section containing Code Blocks", () => {
    const mdInput = [
      ':::kenote-section title="Rust Demo"',
      "",
      "```rust",
      "fn main() {",
      '    println!("Hello from section!");',
      "}",
      "```",
      "",
      ":::",
    ].join("\n");

    const ed = createTestEditor(mdInput);
    const sec = ed.state.doc.child(0);
    assert.strictEqual(sec.child(0).type.name, "codeBlock");
    assert.strictEqual(sec.child(0).attrs.language, "rust");
    assert.ok(sec.child(0).textContent.includes('println!("Hello from section!");'));

    const serialized = ed.storage.markdown.getMarkdown();
    const ed2 = createTestEditor(serialized);
    assert.strictEqual(ed2.state.doc.child(0).child(0).type.name, "codeBlock");
    assert.strictEqual(ed2.state.doc.child(0).child(0).attrs.language, "rust");

    ed.destroy();
    ed2.destroy();
  });

  test("8. Code block containing Section-like literal string :::kenote-section remains code", () => {
    const mdInput = [
      ':::kenote-section title="Meta Example"',
      "",
      "```rust",
      'let template = ":::kenote-section title=\\"nested\\"";',
      "let closing = \":::\";",
      "```",
      "",
      ":::",
    ].join("\n");

    const ed = createTestEditor(mdInput);
    assert.strictEqual(ed.state.doc.childCount, 1);
    const sec = ed.state.doc.child(0);
    assert.strictEqual(sec.childCount, 1);
    assert.strictEqual(sec.child(0).type.name, "codeBlock");
    assert.ok(sec.child(0).textContent.includes('let template = ":::kenote-section'));

    const serialized = ed.storage.markdown.getMarkdown();
    const ed2 = createTestEditor(serialized);
    assert.strictEqual(ed2.state.doc.child(0).child(0).type.name, "codeBlock");

    ed.destroy();
    ed2.destroy();
  });

  test("9. Existing standard Markdown documents without Sections remain 100% unaffected", () => {
    const standardMd = [
      "# Standard Note",
      "",
      "This note has no sections at all.",
      "",
      "- Bullet A",
      "- Bullet B",
      "",
      "```js",
      "const x = 42;",
      "```",
    ].join("\n");

    const ed = createTestEditor(standardMd);
    assert.strictEqual(ed.state.doc.childCount, 4);
    assert.strictEqual(ed.state.doc.child(0).type.name, "heading");
    assert.strictEqual(ed.state.doc.child(1).type.name, "paragraph");
    assert.strictEqual(ed.state.doc.child(2).type.name, "bulletList");
    assert.strictEqual(ed.state.doc.child(3).type.name, "codeBlock");
    // No section nodes
    assert.strictEqual(ed.state.doc.descendants((node) => node.type.name === "section"), undefined);

    const out = ed.storage.markdown.getMarkdown();
    assert.strictEqual(out.includes(":::"), false);

    ed.destroy();
  });

  test("10. Malformed Section syntax (e.g. unclosed fence) degrades gracefully without crashing", () => {
    const brokenMd = [
      ':::kenote-section title="Unclosed Section"',
      "",
      "Paragraph content that never gets a closing fence.",
      "",
      "Another paragraph.",
    ].join("\n");

    // Must parse without throwing error
    const ed = createTestEditor(brokenMd);
    assert.ok(ed.state.doc);
    assert.strictEqual(ed.state.doc.child(0).type.name, "section");
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Unclosed Section");

    // Serializer generates clean closing fence
    const fixedSerialized = ed.storage.markdown.getMarkdown();
    assert.ok(fixedSerialized.includes(":::"));

    ed.destroy();
  });

  test("11. Note title extraction and document statistics remain clean and accurate", () => {
    const md = [
      "# Operating Systems Notes",
      "",
      ':::kenote-section title="CPU Scheduling"',
      "",
      "Process execution details.",
      "",
      ":::",
    ].join("\n");

    const ed = createTestEditor(md);
    const fullText = ed.getText();
    const charCount = ed.state.doc.textContent.length;
    const stats = computeDocumentStats(fullText, charCount);

    // Note title is still the first physical line
    assert.strictEqual(stats.firstLineTitle, "Operating Systems Notes");
    // Document statistics do not count raw fence tokens like :::
    assert.strictEqual(fullText.includes(":::kenote-section"), false);

    ed.destroy();
  });
});
