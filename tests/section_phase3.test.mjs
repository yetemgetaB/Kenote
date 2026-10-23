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

describe("Section Enhancements Phase 3 Tests", () => {
  test("1. Section node schema defaults color to 'default' and isCollapsed to false", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Phase 3 Stack" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Stack body text" }],
            },
          ],
        },
      ],
    });

    const node = ed.state.doc.child(0);
    assert.strictEqual(node.type.name, "section");
    assert.strictEqual(node.attrs.title, "Phase 3 Stack");
    assert.strictEqual(node.attrs.color, "default");
    assert.strictEqual(node.attrs.isCollapsed, false);

    ed.destroy();
  });

  test("2. Section node accepts custom color and isCollapsed attributes", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Emerald Stack", color: "emerald", isCollapsed: true },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Collapsed emerald content" }],
            },
          ],
        },
      ],
    });

    const node = ed.state.doc.child(0);
    assert.strictEqual(node.attrs.color, "emerald");
    assert.strictEqual(node.attrs.isCollapsed, true);

    ed.destroy();
  });

  test("3. Markdown serialization includes color and isCollapsed when non-default", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Accent Stack", color: "purple", isCollapsed: true },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Purple text" }],
            },
          ],
        },
      ],
    });

    const md = ed.storage.markdown.getMarkdown();
    assert.match(md, /:::kenote-section title="Accent Stack" color="purple" isCollapsed="true"/);

    ed.destroy();
  });

  test("4. Markdown serialization omits color and isCollapsed when default", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Default Stack", color: "default", isCollapsed: false },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Clean stack" }],
            },
          ],
        },
      ],
    });

    const md = ed.storage.markdown.getMarkdown();
    assert.match(md, /:::kenote-section title="Default Stack"\s*\n/);
    assert.doesNotMatch(md, /color=/);
    assert.doesNotMatch(md, /isCollapsed=/);

    ed.destroy();
  });

  test("5. Markdown parsing round-trips color and isCollapsed attributes", () => {
    const markdownInput = `:::kenote-section title="Amber Alert" color="amber" isCollapsed="true"

Warning message inside amber stack.

:::`;

    const ed = createTestEditor(markdownInput);
    const node = ed.state.doc.child(0);

    assert.strictEqual(node.type.name, "section");
    assert.strictEqual(node.attrs.title, "Amber Alert");
    assert.strictEqual(node.attrs.color, "amber");
    assert.strictEqual(node.attrs.isCollapsed, true);

    ed.destroy();
  });

  test("6. collapseAllSections collapses all sections in the document", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Stack 1", isCollapsed: false },
          content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }],
        },
        {
          type: "section",
          attrs: { title: "Stack 2", isCollapsed: false },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Two" }] }],
        },
      ],
    });

    assert.strictEqual(ed.state.doc.child(0).attrs.isCollapsed, false);
    assert.strictEqual(ed.state.doc.child(1).attrs.isCollapsed, false);

    const success = ed.commands.collapseAllSections();
    assert.strictEqual(success, true);

    assert.strictEqual(ed.state.doc.child(0).attrs.isCollapsed, true);
    assert.strictEqual(ed.state.doc.child(1).attrs.isCollapsed, true);

    ed.destroy();
  });

  test("7. expandAllSections expands all sections in the document", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Stack 1", isCollapsed: true },
          content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }],
        },
        {
          type: "section",
          attrs: { title: "Stack 2", isCollapsed: true },
          content: [{ type: "paragraph", content: [{ type: "text", text: "Two" }] }],
        },
      ],
    });

    assert.strictEqual(ed.state.doc.child(0).attrs.isCollapsed, true);
    assert.strictEqual(ed.state.doc.child(1).attrs.isCollapsed, true);

    const success = ed.commands.expandAllSections();
    assert.strictEqual(success, true);

    assert.strictEqual(ed.state.doc.child(0).attrs.isCollapsed, false);
    assert.strictEqual(ed.state.doc.child(1).attrs.isCollapsed, false);

    ed.destroy();
  });

  test("8. Nested stacks are all affected by collapseAllSections and expandAllSections", () => {
    const ed = createTestEditor({
      type: "doc",
      content: [
        {
          type: "section",
          attrs: { title: "Outer Stack", isCollapsed: false },
          content: [
            {
              type: "section",
              attrs: { title: "Inner Stack", isCollapsed: false },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Nested content" }] }],
            },
          ],
        },
      ],
    });

    ed.commands.collapseAllSections();

    const outer = ed.state.doc.child(0);
    const inner = outer.child(0);
    assert.strictEqual(outer.attrs.isCollapsed, true);
    assert.strictEqual(inner.attrs.isCollapsed, true);

    ed.commands.expandAllSections();

    const outerExpanded = ed.state.doc.child(0);
    const innerExpanded = outerExpanded.child(0);
    assert.strictEqual(outerExpanded.attrs.isCollapsed, false);
    assert.strictEqual(innerExpanded.attrs.isCollapsed, false);

    ed.destroy();
  });

  test("9. Backward compatibility: existing markdown sections without attributes parse gracefully", () => {
    const legacyMarkdown = `:::kenote-section title="Legacy Section"

Legacy body content.

:::`;

    const ed = createTestEditor(legacyMarkdown);
    const node = ed.state.doc.child(0);

    assert.strictEqual(node.attrs.title, "Legacy Section");
    assert.strictEqual(node.attrs.color, "default");
    assert.strictEqual(node.attrs.isCollapsed, false);

    ed.destroy();
  });
});
