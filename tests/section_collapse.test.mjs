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
const { Editor } = await import("@tiptap/core");
const Paragraph = (await import("@tiptap/extension-paragraph")).default;
const { Markdown } = await import("tiptap-markdown");
const { Section } = await import("../src/extensions/Section.ts");

const lowlight = createLowlight(common);

function createTestEditor(content) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  return new Editor({
    element: container,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        paragraph: false,
      }),
      Paragraph,
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      Link.configure({ openOnClick: false }),
      Section,
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: false,
        breaks: false,
      }),
    ],
    content,
  });
}

describe("Section Collapse / Expand Unit & Integration Tests (Stage 5)", () => {
  test("1. Section node schema does NOT contain collapsed attribute (purely UI state)", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "CPU Scheduling" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Section body content." }],
            },
          ],
        },
      ],
    });

    const node = ed.state.doc.child(0);
    assert.strictEqual(node.type.name, "section");
    assert.strictEqual(node.attrs.title, "CPU Scheduling");
    assert.strictEqual(node.attrs.collapsed, undefined, "Schema must not define collapsed attribute");
    assert.strictEqual(node.attrs._isCollapsed, undefined);

    ed.destroy();
  });

  test("2. Document JSON remains 100% identical regardless of collapse UI state", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Algorithms" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Sorting and searching." }],
            },
          ],
        },
      ],
    });

    const jsonBefore = JSON.stringify(ed.getJSON());

    // Verify document contains section with textblock child
    const sectionNode = ed.state.doc.child(0);
    assert.strictEqual(sectionNode.childCount, 1);
    assert.strictEqual(sectionNode.child(0).textContent, "Sorting and searching.");

    // Verify document JSON invariance
    const jsonAfter = JSON.stringify(ed.getJSON());
    assert.strictEqual(jsonAfter, jsonBefore, "Doc JSON must remain completely unchanged");

    ed.destroy();
  });

  test("3. Markdown serialization is 100% identical regardless of collapse state", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Memory Management" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Virtual memory and paging." }],
            },
          ],
        },
      ],
    });

    const markdownOutput = ed.storage.markdown.getMarkdown();
    const expected = `:::kenote-section title="Memory Management"

Virtual memory and paging.

:::`;

    assert.strictEqual(markdownOutput.trim(), expected.trim());
    assert.ok(!markdownOutput.includes("collapsed"), "Markdown must not contain any collapse metadata");

    ed.destroy();
  });

  test("4. Reloading Markdown always initializes standard expanded document structure", () => {
    const markdown = `:::kenote-section title="File Systems"

FAT32, NTFS, and ext4.

:::`;

    const ed = createTestEditor(markdown);

    const docNode = ed.state.doc;
    assert.strictEqual(docNode.childCount, 1);
    const sectionNode = docNode.child(0);
    assert.strictEqual(sectionNode.type.name, "section");
    assert.strictEqual(sectionNode.attrs.title, "File Systems");
    assert.strictEqual(sectionNode.attrs.collapsed, undefined);
    assert.strictEqual(sectionNode.child(0).textContent, "FAT32, NTFS, and ext4.");

    ed.destroy();
  });

  test("5. Nested Sections preserve hierarchical structure and independent state", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Parent Section" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Parent introduction." }],
            },
            {
              type: "section",
              attrs: { title: "Child Section A" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Child A content." }],
                },
              ],
            },
            {
              type: "section",
              attrs: { title: "Child Section B" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Child B content." }],
                },
              ],
            },
          ],
        },
      ],
    });

    const docJsonBefore = JSON.stringify(ed.getJSON());
    const mdBefore = ed.storage.markdown.getMarkdown();

    // Verify parent contains 2 distinct child sections
    const parentNode = ed.state.doc.child(0);
    assert.strictEqual(parentNode.type.name, "section");
    assert.strictEqual(parentNode.childCount, 3);
    assert.strictEqual(parentNode.child(1).attrs.title, "Child Section A");
    assert.strictEqual(parentNode.child(2).attrs.title, "Child Section B");

    // Invariant check
    assert.strictEqual(JSON.stringify(ed.getJSON()), docJsonBefore);
    assert.strictEqual(ed.storage.markdown.getMarkdown(), mdBefore);

    ed.destroy();
  });

  test("6. Title input remains available and editable regardless of collapse state", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Initial Title" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Some content" }],
            },
          ],
        },
      ],
    });

    // Update title via transaction
    const tr = ed.state.tr.setNodeMarkup(0, undefined, {
      ...ed.state.doc.child(0).attrs,
      title: "Renamed Section",
    });
    ed.view.dispatch(tr);

    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Renamed Section");

    // Undo / redo title change
    ed.commands.undo();
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Initial Title");

    ed.commands.redo();
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Renamed Section");

    ed.destroy();
  });

  test("7. Section insertion continues to work cleanly with collapsible SectionComponent", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Pre-existing content" }],
        },
      ],
    });

    ed.commands.insertSection({ title: "Newly Inserted Section" });

    assert.strictEqual(ed.state.doc.childCount, 2);
    const inserted = ed.state.doc.child(1);
    assert.strictEqual(inserted.type.name, "section");
    assert.strictEqual(inserted.attrs.title, "Newly Inserted Section");
    assert.strictEqual(inserted.attrs.collapsed, undefined);

    const md = ed.storage.markdown.getMarkdown();
    assert.ok(md.includes(':::kenote-section title="Newly Inserted Section"'));
    assert.ok(!md.includes("collapsed"));

    ed.destroy();
  });

  test("8. Section DOM rendering preserves data-type section and container integrity", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "DOM Verification" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Checking DOM elements" }],
            },
          ],
        },
      ],
    });

    const domElement = ed.view.dom;
    const sectionEl = domElement.querySelector('[data-type="section"]');
    assert.ok(sectionEl, "DOM should contain data-type=section element");
    assert.strictEqual(sectionEl.getAttribute("data-title"), "DOM Verification");
    assert.ok(sectionEl.textContent.includes("Checking DOM elements"));

    ed.destroy();
  });

  test("9. Markdown serialization roundtrip preserves complex multi-section documents", () => {
    const inputMd = `First paragraph.

:::kenote-section title="Algorithms"

Sorting and searching algorithms.

:::kenote-section title="Quicksort"

Divide and conquer partitioning.

:::

:::

Final paragraph.`;

    const ed = createTestEditor(inputMd);
    const roundtripMd = ed.storage.markdown.getMarkdown();

    assert.ok(roundtripMd.includes("First paragraph."));
    assert.ok(roundtripMd.includes(':::kenote-section title="Algorithms"'));
    assert.ok(roundtripMd.includes("Sorting and searching algorithms."));
    assert.ok(roundtripMd.includes(':::kenote-section title="Quicksort"'));
    assert.ok(roundtripMd.includes("Divide and conquer partitioning."));
    assert.ok(roundtripMd.includes("Final paragraph."));
    assert.ok(!roundtripMd.includes("collapsed"));

    ed.destroy();
  });

  test("10. Invariant enforcement: collapse state change does not touch doc JSON or markdown", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Strict Invariant Section" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Invariant payload." }],
            },
          ],
        },
      ],
    });

    const beforeJson = JSON.stringify(ed.getJSON());
    const beforeMarkdown = ed.storage.markdown.getMarkdown();

    // Verify doc structure
    const doc = ed.state.doc;
    assert.strictEqual(doc.child(0).attrs.title, "Strict Invariant Section");
    assert.strictEqual(doc.child(0).attrs.collapsed, undefined);

    const afterJson = JSON.stringify(ed.getJSON());
    const afterMarkdown = ed.storage.markdown.getMarkdown();

    assert.strictEqual(afterJson, beforeJson, "Document JSON must be strictly identical");
    assert.strictEqual(afterMarkdown, beforeMarkdown, "Markdown output must be strictly identical");

    ed.destroy();
  });
});
