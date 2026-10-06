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

function createTestEditor(initialContent) {
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
    content: initialContent,
  });
}

describe("Section Insertion & Command Tests (Stage 4)", () => {
  test("1. Insert Section into an empty document", () => {
    const ed = createTestEditor("");
    assert.strictEqual(ed.state.doc.childCount, 1);
    assert.strictEqual(ed.state.doc.child(0).type.name, "paragraph");

    const success = ed.commands.insertSection();
    assert.strictEqual(success, true);

    assert.strictEqual(ed.state.doc.childCount, 1);
    const sec = ed.state.doc.child(0);
    assert.strictEqual(sec.type.name, "section");
    assert.strictEqual(sec.attrs.title, "Untitled Section");
    assert.strictEqual(sec.attrs._autoFocus, true);
    assert.strictEqual(sec.childCount, 1);
    assert.strictEqual(sec.child(0).type.name, "paragraph");

    ed.destroy();
  });

  test("2. Insert Section after a paragraph", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First line" }],
        },
      ],
    });

    ed.commands.setTextSelection(10);
    const success = ed.commands.insertSection({ title: "New Chapter" });
    assert.strictEqual(success, true);

    assert.strictEqual(ed.state.doc.childCount, 2);
    assert.strictEqual(ed.state.doc.child(0).type.name, "paragraph");
    assert.strictEqual(ed.state.doc.child(0).textContent, "First line");
    assert.strictEqual(ed.state.doc.child(1).type.name, "section");
    assert.strictEqual(ed.state.doc.child(1).attrs.title, "New Chapter");

    ed.destroy();
  });

  test("3. Insert Section between paragraphs", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Paragraph A" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Paragraph B" }],
        },
      ],
    });

    // Place selection in Paragraph A
    ed.commands.setTextSelection(5);
    ed.commands.insertSection({ title: "Middle Section" });

    assert.strictEqual(ed.state.doc.childCount, 3);
    assert.strictEqual(ed.state.doc.child(0).textContent, "Paragraph A");
    assert.strictEqual(ed.state.doc.child(1).type.name, "section");
    assert.strictEqual(ed.state.doc.child(1).attrs.title, "Middle Section");
    assert.strictEqual(ed.state.doc.child(2).textContent, "Paragraph B");

    ed.destroy();
  });

  test("4. Insert Section before an existing Section", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Preceding note" }],
        },
        {
          type: "section",
          attrs: { title: "Existing Section" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Existing content" }],
            },
          ],
        },
      ],
    });

    // Place selection in the preceding paragraph
    ed.commands.setTextSelection(5);
    ed.commands.insertSection({ title: "Inserted Section" });

    assert.strictEqual(ed.state.doc.childCount, 3);
    assert.strictEqual(ed.state.doc.child(0).textContent, "Preceding note");
    assert.strictEqual(ed.state.doc.child(1).attrs.title, "Inserted Section");
    assert.strictEqual(ed.state.doc.child(2).attrs.title, "Existing Section");

    ed.destroy();
  });

  test("5. Insert Section after an existing Section", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "First Section" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "First content" }],
            },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Trailing paragraph" }],
        },
      ],
    });

    // Place selection in trailing paragraph
    ed.commands.setTextSelection(ed.state.doc.content.size - 2);
    ed.commands.insertSection({ title: "Second Section" });

    assert.strictEqual(ed.state.doc.childCount, 3);
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "First Section");
    assert.strictEqual(ed.state.doc.child(1).textContent, "Trailing paragraph");
    assert.strictEqual(ed.state.doc.child(2).attrs.title, "Second Section");

    ed.destroy();
  });

  test("6. Insert Section inside an existing Section (creating a nested Section)", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Parent Section" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Parent intro text" }],
            },
          ],
        },
      ],
    });

    // Place selection inside the parent's paragraph
    ed.commands.setTextSelection(5);
    ed.commands.insertSection({ title: "Child Section" });

    const parent = ed.state.doc.child(0);
    assert.strictEqual(parent.type.name, "section");
    assert.strictEqual(parent.attrs.title, "Parent Section");
    assert.strictEqual(parent.childCount, 2);

    const child = parent.child(1);
    assert.strictEqual(child.type.name, "section");
    assert.strictEqual(child.attrs.title, "Child Section");
    assert.strictEqual(child.child(0).type.name, "paragraph");

    ed.destroy();
  });

  test("7. Multiple Section insertions across paragraphs", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Line 1" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Line 2" }],
        },
      ],
    });

    ed.commands.setTextSelection(2);
    ed.commands.insertSection({ title: "Sec 1" });

    ed.commands.setTextSelection(ed.state.doc.content.size - 2);
    ed.commands.insertSection({ title: "Sec 2" });

    const titles = [];
    ed.state.doc.forEach((node) => {
      if (node.type.name === "section") {
        titles.push(node.attrs.title);
      }
    });

    assert.ok(titles.includes("Sec 1"));
    assert.ok(titles.includes("Sec 2"));

    ed.destroy();
  });

  test("8. Default title is 'Untitled Section' when omitted", () => {
    const ed = createTestEditor("");
    ed.commands.insertSection();

    const sec = ed.state.doc.child(0);
    assert.strictEqual(sec.attrs.title, "Untitled Section");

    ed.destroy();
  });

  test("9. Inserted Section contains a valid editable paragraph body", () => {
    const ed = createTestEditor("");
    ed.commands.insertSection({ title: "Active Section" });

    const sec = ed.state.doc.child(0);
    assert.strictEqual(sec.childCount, 1);
    assert.strictEqual(sec.child(0).type.name, "paragraph");

    // Insert text into the section body
    ed.commands.insertContent("Typed content inside section");
    assert.ok(ed.state.doc.child(0).child(0).textContent.includes("Typed content inside section"));

    ed.destroy();
  });

  test("10. Undo and redo preserve Section insertion correctly", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Before insertion" }],
        },
      ],
    });

    ed.commands.setTextSelection(5);
    ed.commands.insertSection({ title: "Undoable Section" });

    assert.strictEqual(ed.state.doc.childCount, 2);
    assert.strictEqual(ed.state.doc.child(1).attrs.title, "Undoable Section");

    // Undo
    ed.commands.undo();
    assert.strictEqual(ed.state.doc.childCount, 1);
    assert.strictEqual(ed.state.doc.child(0).textContent, "Before insertion");

    // Redo
    ed.commands.redo();
    assert.strictEqual(ed.state.doc.childCount, 2);
    assert.strictEqual(ed.state.doc.child(1).attrs.title, "Undoable Section");

    ed.destroy();
  });

  test("11. Command is registered in editor.commands and setSection alias works", () => {
    const ed = createTestEditor("");
    assert.strictEqual(typeof ed.commands.insertSection, "function");
    assert.strictEqual(typeof ed.commands.setSection, "function");

    ed.commands.setSection({ title: "Alias Section" });
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Alias Section");

    ed.destroy();
  });

  test("12. Existing non-Section editor commands and behavior remain unchanged", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Plain text" }],
        },
      ],
    });

    ed.commands.setTextSelection({ from: 1, to: 11 });
    ed.commands.toggleBold();
    assert.ok(ed.state.doc.child(0).child(0).marks.some((m) => m.type.name === "bold"));

    ed.commands.setHeading({ level: 1 });
    assert.strictEqual(ed.state.doc.child(0).type.name, "heading");

    ed.destroy();
  });
});
