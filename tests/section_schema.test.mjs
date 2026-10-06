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
const { Editor } = await import("@tiptap/core");
const Paragraph = (await import("@tiptap/extension-paragraph")).default;
const { Section } = await import("../src/extensions/Section.ts");

const lowlight = createLowlight(common);

function createTestEditor(content) {
  return new Editor({
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

describe("Section Schema Foundation (Stage 1)", () => {
  test("1. Section creation with default and custom title attribute", () => {
    // Default title
    const ed1 = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Section body text" }],
            },
          ],
        },
      ],
    });

    const firstNode = ed1.state.doc.child(0);
    assert.strictEqual(firstNode.type.name, "section");
    assert.strictEqual(firstNode.attrs.title, "Untitled Section");
    assert.strictEqual(firstNode.childCount, 1);
    assert.strictEqual(firstNode.child(0).type.name, "paragraph");
    assert.strictEqual(firstNode.child(0).textContent, "Section body text");
    ed1.destroy();

    // Custom title
    const ed2 = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "CPU Scheduling" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Overview of scheduling algorithms" }],
            },
          ],
        },
      ],
    });

    const customNode = ed2.state.doc.child(0);
    assert.strictEqual(customNode.type.name, "section");
    assert.strictEqual(customNode.attrs.title, "CPU Scheduling");
    assert.strictEqual(customNode.textContent, "Overview of scheduling algorithms");
    ed2.destroy();
  });

  test("2. Normal block content support inside Section", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Comprehensive Block Test" },
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Subheading" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Paragraph content with inline marks" }],
            },
            {
              type: "codeBlock",
              attrs: { language: "rust" },
              content: [{ type: "text", text: "fn main() {}" }],
            },
            {
              type: "blockquote",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "A quoted note inside section" }],
                },
              ],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Bullet Item 1" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "taskList",
              content: [
                {
                  type: "taskItem",
                  attrs: { checked: true },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Completed section task" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "horizontalRule",
            },
          ],
        },
      ],
    });

    const sec = ed.state.doc.child(0);
    assert.strictEqual(sec.type.name, "section");
    assert.strictEqual(sec.childCount, 7);
    assert.strictEqual(sec.child(0).type.name, "heading");
    assert.strictEqual(sec.child(1).type.name, "paragraph");
    assert.strictEqual(sec.child(2).type.name, "codeBlock");
    assert.strictEqual(sec.child(3).type.name, "blockquote");
    assert.strictEqual(sec.child(4).type.name, "bulletList");
    assert.strictEqual(sec.child(5).type.name, "taskList");
    assert.strictEqual(sec.child(6).type.name, "horizontalRule");
    ed.destroy();
  });

  test("3. Nested Section (2 levels)", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Parent Section" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Parent paragraph" }],
            },
            {
              type: "section",
              attrs: { title: "Child Section" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Child paragraph" }],
                },
              ],
            },
          ],
        },
      ],
    });

    const parent = ed.state.doc.child(0);
    assert.strictEqual(parent.type.name, "section");
    assert.strictEqual(parent.attrs.title, "Parent Section");
    assert.strictEqual(parent.childCount, 2);

    const child = parent.child(1);
    assert.strictEqual(child.type.name, "section");
    assert.strictEqual(child.attrs.title, "Child Section");
    assert.strictEqual(child.child(0).textContent, "Child paragraph");
    ed.destroy();
  });

  test("4. Multiple nested levels (3 levels deep)", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Level 1" },
          content: [
            {
              type: "section",
              attrs: { title: "Level 2" },
              content: [
                {
                  type: "section",
                  attrs: { title: "Level 3" },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Deeply nested text" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const l1 = ed.state.doc.child(0);
    const l2 = l1.child(0);
    const l3 = l2.child(0);

    assert.strictEqual(l1.attrs.title, "Level 1");
    assert.strictEqual(l2.attrs.title, "Level 2");
    assert.strictEqual(l3.attrs.title, "Level 3");
    assert.strictEqual(l3.child(0).textContent, "Deeply nested text");
    ed.destroy();
  });

  test("5. Mixed content coexisting with sections and normal paragraphs", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Top-level intro paragraph" }],
        },
        {
          type: "section",
          attrs: { title: "Section 1" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Section 1 paragraph A" }],
            },
            {
              type: "codeBlock",
              attrs: { language: "js" },
              content: [{ type: "text", text: "console.log(1);" }],
            },
            {
              type: "section",
              attrs: { title: "Section 1.1 Nested" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Nested paragraph" }],
                },
              ],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Section 1 paragraph B" }],
            },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Middle paragraph outside sections" }],
        },
        {
          type: "section",
          attrs: { title: "Section 2" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Section 2 paragraph" }],
            },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Conclusion paragraph" }],
        },
      ],
    });

    assert.strictEqual(ed.state.doc.childCount, 5);
    assert.strictEqual(ed.state.doc.child(0).type.name, "paragraph");
    assert.strictEqual(ed.state.doc.child(1).type.name, "section");
    assert.strictEqual(ed.state.doc.child(2).type.name, "paragraph");
    assert.strictEqual(ed.state.doc.child(3).type.name, "section");
    assert.strictEqual(ed.state.doc.child(4).type.name, "paragraph");
    ed.destroy();
  });

  test("6. Existing documents without Sections remain 100% valid", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Standard Note Title" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Standard Note Body" }],
        },
        {
          type: "codeBlock",
          content: [{ type: "text", text: "const a = 10;" }],
        },
      ],
    });

    assert.strictEqual(ed.state.doc.childCount, 3);
    assert.strictEqual(ed.state.doc.child(0).type.name, "paragraph");
    assert.strictEqual(ed.state.doc.child(1).type.name, "paragraph");
    assert.strictEqual(ed.state.doc.child(2).type.name, "codeBlock");
    ed.destroy();
  });

  test("7. Schema validation enforces block+ (rejects direct inline content without textblock)", () => {
    const schema = createTestEditor("").schema;
    const sectionType = schema.nodes.section;

    // Direct text inside section without a paragraph container is invalid against 'block+'
    assert.throws(() => {
      sectionType.createChecked(
        { title: "Invalid Section" },
        schema.text("Direct naked text")
      );
    }, /Invalid content for node section/);

    // Valid block content succeeds
    const validSection = sectionType.createChecked(
      { title: "Valid Section" },
      schema.nodes.paragraph.createChecked(null, schema.text("Wrapped in paragraph"))
    );
    assert.strictEqual(validSection.type.name, "section");
  });

  test("8. Section title updates participate in ProseMirror transaction and history", () => {
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

    const pos = 0;
    const node = ed.state.doc.child(0);
    assert.strictEqual(node.attrs.title, "Initial Title");

    // Update title via transaction
    const tr = ed.state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      title: "Updated Title",
    });
    ed.view.dispatch(tr);

    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Updated Title");

    // Undo restores previous title
    ed.commands.undo();
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Initial Title");

    // Redo reapplies updated title
    ed.commands.redo();
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Updated Title");

    ed.destroy();
  });
});
