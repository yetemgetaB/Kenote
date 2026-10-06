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
    ],
    content,
  });
}

describe("Section NodeView & Title UI Tests (Stage 2)", () => {
  test("1. Section renders container with data-type section and title attribute", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "CPU Scheduling" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Process execution and scheduling criteria." }],
            },
          ],
        },
      ],
    });

    const domElement = ed.view.dom;
    const sectionEl = domElement.querySelector('[data-type="section"]');
    assert.ok(sectionEl, "Section element should exist in DOM");
    assert.strictEqual(sectionEl.getAttribute("data-title"), "CPU Scheduling");
    assert.strictEqual(sectionEl.className.includes("kenote-section"), true);
    assert.ok(sectionEl.textContent.includes("Process execution and scheduling criteria."));

    ed.destroy();
  });

  test("2. Default title attribute renders default value correctly", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Default section text." }],
            },
          ],
        },
      ],
    });

    const node = ed.state.doc.child(0);
    assert.strictEqual(node.attrs.title, "Untitled Section");

    const sectionEl = ed.view.dom.querySelector('[data-type="section"]');
    assert.ok(sectionEl);
    assert.strictEqual(sectionEl.getAttribute("data-title"), "Untitled Section");

    ed.destroy();
  });

  test("3. Empty title is permitted without forcing Untitled Section back", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Section with cleared title." }],
            },
          ],
        },
      ],
    });

    const node = ed.state.doc.child(0);
    assert.strictEqual(node.attrs.title, "");

    const sectionEl = ed.view.dom.querySelector('[data-type="section"]');
    assert.ok(sectionEl);
    assert.strictEqual(sectionEl.getAttribute("data-title"), "");

    ed.destroy();
  });

  test("4. Title attribute updates via transaction participate in editor undo/redo history", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Initial Title" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Body content." }],
            },
          ],
        },
      ],
    });

    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Initial Title");

    // Update title via transaction (same mechanism as SectionComponent updateAttributes)
    const node = ed.state.doc.child(0);
    const tr = ed.state.tr.setNodeMarkup(0, undefined, {
      ...node.attrs,
      title: "Modified Title",
    });
    ed.view.dispatch(tr);

    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Modified Title");

    // Test undo
    ed.commands.undo();
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Initial Title");

    // Test redo
    ed.commands.redo();
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Modified Title");

    ed.destroy();
  });

  test("5. Nested Sections render and preserve hierarchical structure and distinct titles", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Outer Section" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Outer text." }],
            },
            {
              type: "section",
              attrs: { title: "Inner Section" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Inner text." }],
                },
              ],
            },
          ],
        },
      ],
    });

    const allSections = ed.view.dom.querySelectorAll('[data-type="section"]');
    assert.strictEqual(allSections.length, 2, "Should render both parent and nested section DOM nodes");
    assert.strictEqual(allSections[0].getAttribute("data-title"), "Outer Section");
    assert.strictEqual(allSections[1].getAttribute("data-title"), "Inner Section");

    ed.destroy();
  });

  test("6. Body text editing and formatting inside Section works normally", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Formatting Test" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Hello World" }],
            },
          ],
        },
      ],
    });

    // Bold the word "Hello" (positions 2 to 7 inside doc)
    ed.commands.setTextSelection({ from: 2, to: 7 });
    ed.commands.toggleBold();

    const textNode = ed.state.doc.child(0).child(0).child(0);
    assert.strictEqual(textNode.text, "Hello");
    assert.ok(textNode.marks.some((m) => m.type.name === "bold"));

    ed.destroy();
  });

  test("7. Copy/paste content preserving section structure", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Original Section" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Original Content" }],
            },
          ],
        },
      ],
    });

    const json = ed.getJSON();
    assert.ok(json.content);
    assert.strictEqual(json.content[0].type, "section");
    assert.strictEqual(json.content[0].attrs.title, "Original Section");

    // Create a second editor from that JSON (simulating copy/paste)
    const ed2 = createTestEditor(json);
    assert.strictEqual(ed2.state.doc.child(0).type.name, "section");
    assert.strictEqual(ed2.state.doc.child(0).attrs.title, "Original Section");
    assert.strictEqual(ed2.state.doc.child(0).child(0).textContent, "Original Content");

    ed.destroy();
    ed2.destroy();
  });
});
