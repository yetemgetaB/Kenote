import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost",
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
globalThis.Blob = dom.window.Blob || Blob;

// Mock ClipboardItem
class MockClipboardItem {
  constructor(data) {
    this.data = data;
  }
}
globalThis.ClipboardItem = MockClipboardItem;

const {
  escapeHtml,
  sanitizeFilename,
  generateStandaloneHtml,
  exportToPdf,
  exportToHtml,
  exportToMarkdown,
  exportToPlainText,
  copyRichText,
  exportAllNotesToFolder,
} = await import("../src/utils/exportNote.ts");
const { api } = await import("../src/utils/tauriBridge.ts");

describe("Note Export Utilities Suite", () => {
  describe("1. escapeHtml", () => {
    it("escapes special HTML characters (&, <, >, \", ')", () => {
      const input = `<script>alert("xss & 'attack'");</script>`;
      const expected = `&lt;script&gt;alert(&quot;xss &amp; &#039;attack&#039;&quot;);&lt;/script&gt;`;
      assert.equal(escapeHtml(input), expected);
    });

    it("returns plain strings unmodified", () => {
      assert.equal(escapeHtml("Hello World 123"), "Hello World 123");
    });

    it("handles empty string gracefully", () => {
      assert.equal(escapeHtml(""), "");
    });
  });

  describe("2. sanitizeFilename", () => {
    it("replaces filesystem illegal characters with dashes", () => {
      const input = `Project / Plan : 2026 * Q1? "Draft" <v1> | final`;
      const sanitized = sanitizeFilename(input);
      assert.equal(sanitized, "Project - Plan - 2026 - Q1- -Draft- -v1- - final");
    });

    it("collapses multiple spaces into single space", () => {
      assert.equal(sanitizeFilename("Meeting     Notes"), "Meeting Notes");
    });

    it("falls back to default or custom fallback when string is empty or stripped", () => {
      assert.equal(sanitizeFilename(""), "Untitled");
      assert.equal(sanitizeFilename("   "), "Untitled");
      assert.equal(sanitizeFilename("", "CustomFallback"), "CustomFallback");
    });
  });

  describe("3. generateStandaloneHtml", () => {
    it("generates a complete HTML5 document with title and stylesheet", () => {
      const html = generateStandaloneHtml("Sprint Planning", "<p>Task list</p>");
      assert.ok(html.startsWith("<!DOCTYPE html>"));
      assert.ok(html.includes("<title>Sprint Planning</title>"));
      assert.ok(html.includes("<h1>Sprint Planning</h1>"));
      assert.ok(html.includes("<p>Task list</p>"));
      assert.ok(html.includes("color-scheme: light dark;"));
      assert.ok(html.includes("font-family: -apple-system"));
    });

    it("safely escapes title in title tag and heading", () => {
      const html = generateStandaloneHtml("<Test & Demo>", "<p>Content</p>");
      assert.ok(html.includes("<title>&lt;Test &amp; Demo&gt;</title>"));
      assert.ok(html.includes("<h1>&lt;Test &amp; Demo&gt;</h1>"));
    });

    it("falls back to default title if empty", () => {
      const html = generateStandaloneHtml("", "<p>Content</p>");
      assert.ok(html.includes("<title>KeNote Document</title>"));
      assert.ok(html.includes("<h1>KeNote Document</h1>"));
    });
  });

  describe("4. File Export Handlers", () => {
    let savedFiles = [];

    beforeEach(() => {
      savedFiles = [];
      api.saveFile = async (defaultFilename, content, filters) => {
        savedFiles.push({ defaultFilename, content, filters });
        return `/mock/path/${defaultFilename}`;
      };
    });

    it("exportToMarkdown saves markdown with .md extension and filter", async () => {
      const result = await exportToMarkdown("My Note", "# Hello Markdown");
      assert.equal(result, "/mock/path/My Note.md");
      assert.equal(savedFiles.length, 1);
      assert.equal(savedFiles[0].defaultFilename, "My Note.md");
      assert.equal(savedFiles[0].content, "# Hello Markdown");
      assert.deepEqual(savedFiles[0].filters, [{ name: "Markdown Document", extensions: ["md"] }]);
    });

    it("exportToPlainText saves text with .txt extension and filter", async () => {
      const result = await exportToPlainText("My Note", "Plain text content");
      assert.equal(result, "/mock/path/My Note.txt");
      assert.equal(savedFiles.length, 1);
      assert.equal(savedFiles[0].defaultFilename, "My Note.txt");
      assert.equal(savedFiles[0].content, "Plain text content");
      assert.deepEqual(savedFiles[0].filters, [{ name: "Text Document", extensions: ["txt"] }]);
    });

    it("exportToHtml generates standalone html and saves with .html extension", async () => {
      const result = await exportToHtml("My Web Note", "<p>Web content</p>");
      assert.equal(result, "/mock/path/My Web Note.html");
      assert.equal(savedFiles.length, 1);
      assert.equal(savedFiles[0].defaultFilename, "My Web Note.html");
      assert.ok(savedFiles[0].content.includes("<!DOCTYPE html>"));
      assert.ok(savedFiles[0].content.includes("<p>Web content</p>"));
      assert.deepEqual(savedFiles[0].filters, [{ name: "HTML Document", extensions: ["html"] }]);
    });
  });

  describe("5. exportToPdf", () => {
    it("calls window.print()", () => {
      let printCalled = false;
      const originalPrint = window.print;
      window.print = () => {
        printCalled = true;
      };

      try {
        exportToPdf();
        assert.equal(printCalled, true);
      } finally {
        window.print = originalPrint;
      }
    });
  });

  describe("6. copyRichText", () => {
    it("writes HTML and Plain Text blobs to navigator.clipboard.write", async () => {
      let writeCalledWith = null;
      globalThis.navigator.clipboard = {
        write: async (items) => {
          writeCalledWith = items;
        },
        writeText: async () => {},
      };

      const mockEditor = {
        getHTML: () => "<h2>Summary</h2><p>Styled text</p>",
        getText: () => "Summary\nStyled text",
      };

      const success = await copyRichText(mockEditor);
      assert.equal(success, true);
      assert.ok(writeCalledWith !== null);
      assert.equal(writeCalledWith.length, 1);
    });

    it("falls back to navigator.clipboard.writeText if write fails", async () => {
      let fallbackText = null;
      globalThis.navigator.clipboard = {
        write: async () => {
          throw new Error("ClipboardItem not supported");
        },
        writeText: async (text) => {
          fallbackText = text;
        },
      };

      const mockEditor = {
        getHTML: () => "<h2>Summary</h2>",
        getText: () => "Summary text",
      };

      const success = await copyRichText(mockEditor);
      assert.equal(success, true);
      assert.equal(fallbackText, "Summary text");
    });
  });

  describe("7. exportAllNotesToFolder", () => {
    it("exports all notes into individual markdown files in browser fallback mode", async () => {
      const saved = [];
      api.saveFile = async (name, content) => {
        saved.push({ name, content });
        return name;
      };

      const mockNotes = [
        { id: "1", title: "Meeting Notes", filename: "note-1.md", content: "# Meeting" },
        { id: "2", title: "Project Spec", filename: "note-2.md", content: "# Spec" },
        { id: "3", title: "", filename: "note-3.md", content: "# Untitled Note" },
      ];

      const res = await exportAllNotesToFolder(mockNotes);
      assert.deepEqual(res, { count: 3 });
      assert.equal(saved.length, 3);
      assert.equal(saved[0].name, "Meeting Notes.md");
      assert.equal(saved[1].name, "Project Spec.md");
      assert.equal(saved[2].name, "note-3.md");
    });
  });
});
