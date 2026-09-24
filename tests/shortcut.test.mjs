import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GLOBAL_SHORTCUT,
  normalizeKey,
  parseKeyboardEventToShortcut,
  isValidGlobalShortcut,
  formatShortcutDisplay,
} from "../src/utils/shortcut.ts";
import { DEFAULT_SETTINGS } from "../src/types/note.ts";

describe("Global Launch Shortcut Unit Tests", () => {
  describe("1. Default Shortcut & Configuration", () => {
    it("has default shortcut set to Alt+Shift+K", () => {
      assert.equal(DEFAULT_GLOBAL_SHORTCUT, "Alt+Shift+K");
      assert.equal(DEFAULT_SETTINGS.global_shortcut, "Alt+Shift+K");
    });

    it("formats default shortcut cleanly for display", () => {
      assert.equal(formatShortcutDisplay(DEFAULT_GLOBAL_SHORTCUT), "Alt + Shift + K");
      assert.equal(formatShortcutDisplay(null), "Alt + Shift + K");
      assert.equal(formatShortcutDisplay(undefined), "Alt + Shift + K");
    });
  });

  describe("2. Key Normalization", () => {
    it("normalizes alphanumeric keys to uppercase", () => {
      assert.equal(normalizeKey("k"), "K");
      assert.equal(normalizeKey("K"), "K");
      assert.equal(normalizeKey("a"), "A");
      assert.equal(normalizeKey("1"), "1");
    });

    it("normalizes function keys properly", () => {
      assert.equal(normalizeKey("F1"), "F1");
      assert.equal(normalizeKey("f12"), "F12");
    });

    it("normalizes Space and special keys", () => {
      assert.equal(normalizeKey(" ", "Space"), "Space");
      assert.equal(normalizeKey("Space"), "Space");
      assert.equal(normalizeKey("Enter"), "Enter");
      assert.equal(normalizeKey("Tab"), "Tab");
      assert.equal(normalizeKey("Backspace"), "Backspace");
    });

    it("returns null for bare modifier keys", () => {
      assert.equal(normalizeKey("Control"), null);
      assert.equal(normalizeKey("Alt"), null);
      assert.equal(normalizeKey("Shift"), null);
      assert.equal(normalizeKey("Meta"), null);
    });
  });

  describe("3. KeyboardEvent Parsing & Validation", () => {
    it("correctly parses Alt+Shift+K combination", () => {
      const result = parseKeyboardEventToShortcut({
        key: "k",
        altKey: true,
        shiftKey: true,
        ctrlKey: false,
        metaKey: false,
      });

      assert.equal(result.isValid, true);
      assert.equal(result.shortcut, "Alt+Shift+K");
      assert.equal(result.display, "Alt + Shift + K");
      assert.equal(result.isModifierOnly, false);
      assert.equal(result.isEscape, false);
    });

    it("correctly parses Ctrl+Space combination", () => {
      const result = parseKeyboardEventToShortcut({
        key: " ",
        code: "Space",
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });

      assert.equal(result.isValid, true);
      assert.equal(result.shortcut, "Ctrl+Space");
      assert.equal(result.display, "Ctrl + Space");
      assert.equal(result.isModifierOnly, false);
      assert.equal(result.isEscape, false);
    });

    it("correctly parses Super/Win modifier combinations", () => {
      const result = parseKeyboardEventToShortcut({
        key: "k",
        metaKey: true,
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
      });

      assert.equal(result.isValid, true);
      assert.equal(result.shortcut, "Shift+Super+K");
      assert.equal(result.isModifierOnly, false);
      assert.equal(result.isEscape, false);
    });

    it("identifies Escape as cancel", () => {
      const result = parseKeyboardEventToShortcut({
        key: "Escape",
      });

      assert.equal(result.isEscape, true);
      assert.equal(result.isValid, false);
      assert.equal(result.shortcut, null);
    });

    it("identifies modifier-only press as waiting state", () => {
      const result = parseKeyboardEventToShortcut({
        key: "Control",
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });

      assert.equal(result.isModifierOnly, true);
      assert.equal(result.isValid, false);
      assert.equal(result.shortcut, null);
    });

    it("rejects non-modifier bare keys", () => {
      const result = parseKeyboardEventToShortcut({
        key: "k",
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });

      assert.equal(result.isValid, false);
      assert.equal(result.shortcut, null);
      assert.match(result.error || "", /modifier/i);
    });
  });

  describe("4. Shortcut String Validation", () => {
    it("validates valid accelerator strings", () => {
      assert.equal(isValidGlobalShortcut("Alt+Shift+K"), true);
      assert.equal(isValidGlobalShortcut("Ctrl+Space"), true);
      assert.equal(isValidGlobalShortcut("Ctrl+Alt+A"), true);
      assert.equal(isValidGlobalShortcut("Super+Shift+K"), true);
    });

    it("rejects invalid accelerator strings", () => {
      assert.equal(isValidGlobalShortcut(""), false);
      assert.equal(isValidGlobalShortcut(null), false);
      assert.equal(isValidGlobalShortcut(undefined), false);
      assert.equal(isValidGlobalShortcut("K"), false);
      assert.equal(isValidGlobalShortcut("Ctrl"), false);
      assert.equal(isValidGlobalShortcut("Ctrl+"), false);
    });
  });

  describe("5. Mock Shortcut Replacement & Error Handling Workflow", () => {
    it("preserves previous shortcut when registration fails", async () => {
      let registeredShortcut = "Alt+Shift+K";

      async function mockUpdateShortcut(newShortcut, shouldFail = false) {
        if (!isValidGlobalShortcut(newShortcut)) {
          throw new Error("Invalid shortcut");
        }
        const previous = registeredShortcut;
        if (shouldFail) {
          // Simulate failure and recovery
          registeredShortcut = previous;
          throw new Error("Shortcut is already registered by another application");
        }
        registeredShortcut = newShortcut;
        return registeredShortcut;
      }

      // Successful update
      const res1 = await mockUpdateShortcut("Ctrl+Space", false);
      assert.equal(res1, "Ctrl+Space");
      assert.equal(registeredShortcut, "Ctrl+Space");

      // Failed update preserves previous
      await assert.rejects(async () => {
        await mockUpdateShortcut("Ctrl+C", true);
      }, /already registered/i);

      assert.equal(registeredShortcut, "Ctrl+Space", "Previous shortcut must be preserved on failure");
    });
  });
});
