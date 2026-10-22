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
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.Range = dom.window.Range;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

const mockRect = () => ({
  top: 0,
  left: 0,
  right: 100,
  bottom: 20,
  width: 100,
  height: 20,
  x: 0,
  y: 0,
  toJSON: () => {},
});
dom.window.Element.prototype.getClientRects = () => [mockRect()];
dom.window.Element.prototype.getBoundingClientRect = mockRect;
dom.window.Range.prototype.getClientRects = () => [mockRect()];
dom.window.Range.prototype.getBoundingClientRect = mockRect;

globalThis.requestAnimationFrame = (cb) => {
  try {
    cb(Date.now());
  } catch {}
  return 0;
};
globalThis.cancelAnimationFrame = () => {};

const StarterKit = (await import("@tiptap/starter-kit")).default;
const { Editor } = await import("@tiptap/core");
const Paragraph = (await import("@tiptap/extension-paragraph")).default;
const { Section } = await import("../src/extensions/Section.ts");

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
      Section,
    ],
    content: initialContent || "<p></p>",
  });
}

describe("Section Menu Actions Tests", () => {
  test("1. Duplicate Stack duplicates the section and its contents immediately below", () => {
    const ed = createTestEditor(
      '<div data-type="section" data-title="Project Alpha"><p>Task 1</p><p>Task 2</p></div>'
    );

    assert.strictEqual(ed.state.doc.childCount, 1);
    const sectionNode = ed.state.doc.child(0);
    assert.strictEqual(sectionNode.attrs.title, "Project Alpha");

    // Perform duplicate
    const pos = 0;
    const afterPos = pos + sectionNode.nodeSize;
    ed.commands.insertContentAt(afterPos, sectionNode.toJSON());

    // Should now have 2 sections with identical content
    assert.strictEqual(ed.state.doc.childCount, 2);
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Project Alpha");
    assert.strictEqual(ed.state.doc.child(1).attrs.title, "Project Alpha");
    assert.strictEqual(ed.state.doc.child(1).child(0).textContent, "Task 1");
    assert.strictEqual(ed.state.doc.child(1).child(1).textContent, "Task 2");

    ed.destroy();
  });

  test("2. Unwrap Stack with custom title creates H3 heading and unwraps child nodes", () => {
    const ed = createTestEditor(
      '<div data-type="section" data-title="Sprint Review"><p>Item 1</p><p>Item 2</p></div>'
    );

    assert.strictEqual(ed.state.doc.child(0).type.name, "section");
    const sectionNode = ed.state.doc.child(0);
    const pos = 0;

    // Perform unwrap
    const tr = ed.state.tr;
    const nodesToInsert = [];
    nodesToInsert.push(
      ed.state.schema.nodes.heading.create(
        { level: 3 },
        ed.state.schema.text("Sprint Review")
      )
    );
    for (let i = 0; i < sectionNode.childCount; i++) {
      nodesToInsert.push(sectionNode.child(i));
    }
    tr.replaceWith(pos, pos + sectionNode.nodeSize, nodesToInsert);
    ed.view.dispatch(tr);

    // Document should now have: heading (H3), paragraph (Item 1), paragraph (Item 2)
    assert.strictEqual(ed.state.doc.childCount, 3);
    assert.strictEqual(ed.state.doc.child(0).type.name, "heading");
    assert.strictEqual(ed.state.doc.child(0).attrs.level, 3);
    assert.strictEqual(ed.state.doc.child(0).textContent, "Sprint Review");
    assert.strictEqual(ed.state.doc.child(1).textContent, "Item 1");
    assert.strictEqual(ed.state.doc.child(2).textContent, "Item 2");

    ed.destroy();
  });

  test("3. Unwrap Stack with 'Untitled Section' unwraps child nodes without extra heading", () => {
    const ed = createTestEditor(
      '<div data-type="section" data-title="Untitled Section"><p>Just text</p></div>'
    );

    const sectionNode = ed.state.doc.child(0);
    const pos = 0;
    const title = sectionNode.attrs.title;

    const tr = ed.state.tr;
    const nodesToInsert = [];
    const hasCustomTitle = title.trim() !== "" && title.trim() !== "Untitled Section";
    if (hasCustomTitle && ed.state.schema.nodes.heading) {
      nodesToInsert.push(
        ed.state.schema.nodes.heading.create({ level: 3 }, ed.state.schema.text(title))
      );
    }
    for (let i = 0; i < sectionNode.childCount; i++) {
      nodesToInsert.push(sectionNode.child(i));
    }
    tr.replaceWith(pos, pos + sectionNode.nodeSize, nodesToInsert);
    ed.view.dispatch(tr);

    // Document should only have the unwrapped paragraph
    assert.strictEqual(ed.state.doc.childCount, 1);
    assert.strictEqual(ed.state.doc.child(0).type.name, "paragraph");
    assert.strictEqual(ed.state.doc.child(0).textContent, "Just text");

    ed.destroy();
  });

  test("4. Delete Stack removes the section node and its contents completely", () => {
    const ed = createTestEditor(
      '<div data-type="section" data-title="Delete Me"><p>Temporary</p></div><p>Remaining</p>'
    );

    assert.strictEqual(ed.state.doc.childCount, 2);
    const sectionNode = ed.state.doc.child(0);
    const pos = 0;

    ed.commands.deleteRange({ from: pos, to: pos + sectionNode.nodeSize });

    assert.strictEqual(ed.state.doc.childCount, 1);
    assert.strictEqual(ed.state.doc.child(0).type.name, "paragraph");
    assert.strictEqual(ed.state.doc.child(0).textContent, "Remaining");

    ed.destroy();
  });

  test("5. Plain text extraction extracts title and inner text cleanly", () => {
    const ed = createTestEditor(
      '<div data-type="section" data-title="Meeting Notes"><p>Line 1</p><p>Line 2</p></div>'
    );

    const sectionNode = ed.state.doc.child(0);
    const title = sectionNode.attrs.title;
    const plainText = `${title ? title + "\n\n" : ""}${sectionNode.textContent}`.trim();

    assert.strictEqual(plainText, "Meeting Notes\n\nLine 1Line 2");

    ed.destroy();
  });
});
