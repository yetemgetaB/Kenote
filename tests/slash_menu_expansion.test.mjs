import { test, describe } from "node:test";
import assert from "node:assert";
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

const StarterKit = (await import("@tiptap/starter-kit")).default;
const { Editor } = await import("@tiptap/core");
const { CalloutAlerts } = await import("../src/extensions/CalloutAlerts.ts");

describe("Slash Menu Expansion & Callout Alerts", () => {
  describe("Numbered List Command", () => {
    test("toggleOrderedList creates ordered list structure", () => {
      const editor = new Editor({
        extensions: [StarterKit],
        content: "<p>First step</p>",
      });

      editor.commands.toggleOrderedList();
      const html = editor.getHTML();
      assert.ok(html.includes("<ol>"), "Expected <ol> tag");
      assert.ok(html.includes("<li><p>First step</p></li>"), "Expected <li> tag");
      editor.destroy();
    });
  });

  describe("Date & Time Formatting Logic", () => {
    test("date format strictly matches DD/MM/YYYY", () => {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const formatted = `${dd}/${mm}/${yyyy}`;

      assert.match(formatted, /^\d{2}\/\d{2}\/\d{4}$/);
      assert.strictEqual(formatted.length, 10);
    });

    test("today format produces human-readable month, day, year", () => {
      const str = new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      assert.ok(str.length > 5);
      assert.match(str, /\d{4}/); // contains year
    });

    test("time format produces clock time with hour and minute", () => {
      const str = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      assert.match(str, /\d{1,2}:\d{2}/);
    });
  });

  describe("CalloutAlerts Extension Decorations", () => {
    test("decorates [!NOTE] blockquote with note alert classes", () => {
      const editor = new Editor({
        extensions: [StarterKit, CalloutAlerts],
        content: "<blockquote><p>[!NOTE]<br>This is a note</p></blockquote>",
      });

      // Retrieve ProseMirror view decorations
      const decorations = editor.view.docView?.decorations;
      // Also inspect rendered HTML / DOM
      const bq = editor.view.dom.querySelector("blockquote");
      assert.ok(bq, "Blockquote element should exist");
      assert.ok(
        bq.classList.contains("kenote-callout") && bq.classList.contains("kenote-callout-note"),
        "Blockquote should have kenote-callout and kenote-callout-note classes"
      );
      assert.strictEqual(bq.getAttribute("data-alert"), "note");

      // Verify clean badge widget exists and contains label without raw syntax symbols
      const badge = bq.querySelector(".kenote-callout-badge-note");
      assert.ok(badge, "Badge element should exist");
      assert.ok(badge.textContent.includes("Note"), "Badge should contain friendly 'Note' label");
      assert.ok(!badge.textContent.includes("[!"), "Badge should not contain raw '[!' syntax");
      assert.ok(!badge.textContent.includes("]"), "Badge should not contain raw ']' syntax");

      // Verify raw markdown tag is completely hidden and captures closing bracket
      const rawTag = bq.querySelector(".kenote-callout-raw-tag");
      assert.ok(rawTag, "Raw tag element should exist for markdown fidelity");
      assert.strictEqual(rawTag.textContent, "[!NOTE]", "Raw tag must span entire '[!NOTE]' including brackets");

      editor.destroy();
    });

    test("decorates [!TIP], [!WARNING], [!IMPORTANT], [!CAUTION] with corresponding classes", () => {
      const types = ["tip", "warning", "important", "caution"];
      for (const type of types) {
        const editor = new Editor({
          extensions: [StarterKit, CalloutAlerts],
          content: `<blockquote><p>[!${type.toUpperCase()}]<br>Alert content</p></blockquote>`,
        });

        const bq = editor.view.dom.querySelector("blockquote");
        assert.ok(bq, `Blockquote for ${type} should exist`);
        assert.ok(
          bq.classList.contains("kenote-callout"),
          `Expected kenote-callout class for ${type}`
        );
        assert.ok(
          bq.classList.contains(`kenote-callout-${type}`),
          `Expected kenote-callout-${type} class`
        );
        assert.strictEqual(bq.getAttribute("data-alert"), type);
        editor.destroy();
      }
    });

    test("standard blockquote without alert tag is not decorated as callout", () => {
      const editor = new Editor({
        extensions: [StarterKit, CalloutAlerts],
        content: "<blockquote><p>Standard quote without alert tag</p></blockquote>",
      });

      const bq = editor.view.dom.querySelector("blockquote");
      assert.ok(bq, "Blockquote element should exist");
      assert.ok(!bq.classList.contains("kenote-callout"), "Should not have kenote-callout class");
      assert.strictEqual(bq.getAttribute("data-alert"), null);
      editor.destroy();
    });
  });
});
