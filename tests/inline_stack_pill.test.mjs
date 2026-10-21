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
const { InlineStackPill, inlineStackPillPluginKey } = await import("../src/extensions/InlineStackPill.ts");

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
      InlineStackPill,
    ],
    content: initialContent || "<p></p>",
  });
}

describe("InlineStackPill Extension Tests", () => {
  test("1. Extension registers activateInlineStackPill and deactivateInlineStackPill commands", () => {
    const ed = createTestEditor("");
    assert.ok(typeof ed.commands.activateInlineStackPill === "function");
    assert.ok(typeof ed.commands.deactivateInlineStackPill === "function");
    ed.destroy();
  });

  test("2. activateInlineStackPill sets plugin state and creates widget decoration", () => {
    const ed = createTestEditor("<p>Hello world</p>");
    const initialState = inlineStackPillPluginKey.getState(ed.state);
    assert.strictEqual(initialState.active, false);

    ed.commands.activateInlineStackPill({ pos: 1 });
    const activeState = inlineStackPillPluginKey.getState(ed.state);
    assert.strictEqual(activeState.active, true);
    assert.strictEqual(activeState.pos, 1);

    // Verify decoration set contains 1 widget
    const plugin = ed.state.plugins.find((p) => p.key === inlineStackPillPluginKey.key);
    assert.ok(plugin);
    const decos = plugin.props.decorations(ed.state);
    assert.strictEqual(decos.find().length, 1);

    ed.destroy();
  });

  test("3. deactivateInlineStackPill removes decoration cleanly", () => {
    const ed = createTestEditor("<p>Hello world</p>");
    ed.commands.activateInlineStackPill({ pos: 1 });
    assert.strictEqual(inlineStackPillPluginKey.getState(ed.state).active, true);

    ed.commands.deactivateInlineStackPill();
    assert.strictEqual(inlineStackPillPluginKey.getState(ed.state).active, false);

    const plugin = ed.state.plugins.find((p) => p.key === inlineStackPillPluginKey.key);
    const decos = plugin.props.decorations(ed.state);
    assert.strictEqual(decos.find().length, 0);

    ed.destroy();
  });

  test("4. Widget DOM renders inline pill structure with badge, input, and button", () => {
    const ed = createTestEditor("<p></p>");
    ed.commands.activateInlineStackPill({ pos: 1 });

    const plugin = ed.state.plugins.find((p) => p.key === inlineStackPillPluginKey.key);
    const decos = plugin.props.decorations(ed.state);
    const widget = decos.find()[0];
    assert.ok(widget);

    // Call the widget DOM creator
    const domNode = widget.type.toDOM(ed.view);
    assert.ok(domNode);
    assert.ok(domNode.classList.contains("kenote-inline-stack-pill"));
    assert.strictEqual(domNode.getAttribute("data-inline-pill"), "stack");

    const input = domNode.querySelector("input");
    assert.ok(input);
    assert.strictEqual(input.placeholder, "Stack title (optional)...");

    const btn = domNode.querySelector("button");
    assert.ok(btn);
    assert.strictEqual(btn.textContent.trim(), "↵");

    ed.destroy();
  });

  test("5. Input Enter creates Section with typed title", () => {
    const ed = createTestEditor("<p></p>");
    ed.commands.activateInlineStackPill({ pos: 1 });

    const plugin = ed.state.plugins.find((p) => p.key === inlineStackPillPluginKey.key);
    const widget = plugin.props.decorations(ed.state).find()[0];
    const domNode = widget.type.toDOM(ed.view);
    const input = domNode.querySelector("input");

    input.value = "Sprint Planning";
    input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    // Pill should be deactivated
    assert.strictEqual(inlineStackPillPluginKey.getState(ed.state).active, false);
    // Section should be created with title Sprint Planning
    assert.strictEqual(ed.state.doc.child(0).type.name, "section");
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Sprint Planning");

    ed.destroy();
  });

  test("6. Input Enter with empty title creates Section titled 'Untitled Section'", () => {
    const ed = createTestEditor("<p></p>");
    ed.commands.activateInlineStackPill({ pos: 1 });

    const plugin = ed.state.plugins.find((p) => p.key === inlineStackPillPluginKey.key);
    const widget = plugin.props.decorations(ed.state).find()[0];
    const domNode = widget.type.toDOM(ed.view);
    const input = domNode.querySelector("input");

    input.value = "   ";
    input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    assert.strictEqual(inlineStackPillPluginKey.getState(ed.state).active, false);
    assert.strictEqual(ed.state.doc.child(0).type.name, "section");
    assert.strictEqual(ed.state.doc.child(0).attrs.title, "Untitled Section");

    ed.destroy();
  });

  test("7. Input Escape cancels pill without creating section", () => {
    const ed = createTestEditor("<p></p>");
    ed.commands.activateInlineStackPill({ pos: 1 });

    const plugin = ed.state.plugins.find((p) => p.key === inlineStackPillPluginKey.key);
    const widget = plugin.props.decorations(ed.state).find()[0];
    const domNode = widget.type.toDOM(ed.view);
    const input = domNode.querySelector("input");

    input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    assert.strictEqual(inlineStackPillPluginKey.getState(ed.state).active, false);
    assert.strictEqual(ed.state.doc.child(0).type.name, "paragraph");

    ed.destroy();
  });

  test("8. Input Backspace on empty input cancels pill", () => {
    const ed = createTestEditor("<p></p>");
    ed.commands.activateInlineStackPill({ pos: 1 });

    const plugin = ed.state.plugins.find((p) => p.key === inlineStackPillPluginKey.key);
    const widget = plugin.props.decorations(ed.state).find()[0];
    const domNode = widget.type.toDOM(ed.view);
    const input = domNode.querySelector("input");

    input.value = "";
    input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));

    assert.strictEqual(inlineStackPillPluginKey.getState(ed.state).active, false);
    assert.strictEqual(ed.state.doc.child(0).type.name, "paragraph");

    ed.destroy();
  });

  test("9. InputRule: typing '/stack ' converts into active inline pill", () => {
    const ed = createTestEditor("");
    ed.commands.insertContent("/stack");
    const handled = ed.view.someProp("handleTextInput", (f) => f(ed.view, 7, 7, " "));
    assert.strictEqual(handled, true);
    assert.strictEqual(inlineStackPillPluginKey.getState(ed.state).active, true);
    ed.destroy();
  });

  test("10. InputRule: typing '/section ' converts into active inline pill", () => {
    const ed = createTestEditor("");
    ed.commands.insertContent("/section");
    const handled = ed.view.someProp("handleTextInput", (f) => f(ed.view, 9, 9, " "));
    assert.strictEqual(handled, true);
    assert.strictEqual(inlineStackPillPluginKey.getState(ed.state).active, true);
    ed.destroy();
  });
});
