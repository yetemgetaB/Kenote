import { describe, it } from "node:test";
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
globalThis.Event = dom.window.Event;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;

const StarterKit = (await import("@tiptap/starter-kit")).default;
const { Editor } = await import("@tiptap/core");
const { Markdown } = await import("tiptap-markdown");
const Table = (await import("@tiptap/extension-table")).default;
const TableRow = (await import("@tiptap/extension-table-row")).default;
const TableCell = (await import("@tiptap/extension-table-cell")).default;
const TableHeader = (await import("@tiptap/extension-table-header")).default;
const { Section } = await import("../src/extensions/Section.ts");

function createTableEditor(initialContent = "<p>Initial</p>") {
  return new Editor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "kenote-table",
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      Section,
      Markdown.configure({
        html: true,
      }),
    ],
    content: initialContent,
  });
}

describe("Note Table Feature Tests", () => {
  describe("1. Table Insertion & DOM Hierarchy", () => {
    it("inserts a 3x3 table with a header row", () => {
      const editor = createTableEditor("<p>Text before table</p>");
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });

      assert.equal(editor.isActive("table"), true);

      const html = editor.getHTML();
      assert.ok(html.includes("<table"), "Must generate <table> element");
      assert.ok(html.includes("<th"), "Must generate <th> header cells");
      assert.ok(html.includes("<td"), "Must generate <td> data cells");
      assert.ok(html.includes("kenote-table"), "Must apply kenote-table class");

      editor.destroy();
    });
  });

  describe("2. Table Row & Column Manipulations", () => {
    it("adds a row after current position", () => {
      const editor = createTableEditor("<p>Text</p>");
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

      editor.commands.addRowAfter();
      const html = editor.getHTML();
      const rowCount = (html.match(/<tr/g) || []).length;
      assert.equal(rowCount, 3, "Table should now have 3 rows");

      editor.destroy();
    });

    it("adds a column after current position", () => {
      const editor = createTableEditor("<p>Text</p>");
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });

      editor.commands.addColumnAfter();
      const html = editor.getHTML();
      const cellCount = (html.match(/<td/g) || []).length;
      assert.equal(cellCount, 6, "2 rows * 3 cols should equal 6 td cells");

      editor.destroy();
    });

    it("deletes a column and a row", () => {
      const editor = createTableEditor("<p>Text</p>");
      editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false });

      editor.commands.deleteColumn();
      let html = editor.getHTML();
      let cellCount = (html.match(/<td/g) || []).length;
      assert.equal(cellCount, 6, "3 rows * 2 cols should equal 6 td cells");

      editor.commands.deleteRow();
      html = editor.getHTML();
      cellCount = (html.match(/<td/g) || []).length;
      assert.equal(cellCount, 4, "2 rows * 2 cols should equal 4 td cells");

      editor.destroy();
    });

    it("deletes the entire table", () => {
      const editor = createTableEditor("<p>Text</p>");
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false });
      assert.equal(editor.isActive("table"), true);

      editor.commands.deleteTable();
      assert.equal(editor.isActive("table"), false);

      const html = editor.getHTML();
      assert.ok(!html.includes("<table"), "Table must be removed from document");

      editor.destroy();
    });
  });

  describe("3. Markdown Roundtrip & GFM Table Fidelity", () => {
    it("serializes table to standard GitHub Flavored Markdown", () => {
      const markdown = "| Feature | Status |\n| --- | --- |\n| Tables | Complete |";
      const editor = createTableEditor(markdown);

      const serialized = editor.storage.markdown.getMarkdown().trim();
      assert.equal(serialized, markdown);

      editor.destroy();
    });

    it("preserves tables nested inside collapsible section containers", () => {
      const markdown = `:::kenote-section title="Specifications" color="blue" isCollapsed="false"

| Metric | Target |
| --- | --- |
| Latency | 16ms |

:::`;
      const editor = createTableEditor(markdown);
      const serialized = editor.storage.markdown.getMarkdown().trim();

      assert.ok(serialized.includes("| Metric | Target |"));
      assert.ok(serialized.includes("| Latency | 16ms |"));
      assert.ok(serialized.includes(":::kenote-section"));

      editor.destroy();
    });
  });
});
