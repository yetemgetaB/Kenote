import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GLOBAL_SHORTCUT,
  normalizeKey,
  parseKeyboardEventToShortcut,
  isValidGlobalShortcut,
  formatShortcutDisplay,
  splitShortcutToKeys,
  checkInternalShortcutConflict,
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

    it("splits shortcut string into individual key tokens", () => {
      assert.deepEqual(splitShortcutToKeys("Alt+Shift+K"), ["Alt", "Shift", "K"]);
      assert.deepEqual(splitShortcutToKeys("Ctrl+Space"), ["Ctrl", "Space"]);
      assert.deepEqual(splitShortcutToKeys("Ctrl+Alt+F13"), ["Ctrl", "Alt", "F13"]);
      assert.deepEqual(splitShortcutToKeys(["Ctrl", "K"]), ["Ctrl", "K"]);
      assert.deepEqual(splitShortcutToKeys(null), []);
    });
  });

  describe("2. Key Normalization & Extended Function Keys (F1-F24)", () => {
    it("normalizes alphanumeric keys to uppercase", () => {
      assert.equal(normalizeKey("k"), "K");
      assert.equal(normalizeKey("K"), "K");
      assert.equal(normalizeKey("a"), "A");
      assert.equal(normalizeKey("1"), "1");
    });

    it("normalizes standard function keys F1-F12", () => {
      assert.equal(normalizeKey("F1"), "F1");
      assert.equal(normalizeKey("f12"), "F12");
    });

    it("normalizes extended function keys F13-F24", () => {
      assert.equal(normalizeKey("F13"), "F13");
      assert.equal(normalizeKey("f13"), "F13");
      assert.equal(normalizeKey("F24"), "F24");
      // Keycode fallback when key is generic/unidentified
      assert.equal(normalizeKey("Unidentified", "F13"), "F13");
      assert.equal(normalizeKey("", "F20"), "F20");
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

    it("correctly parses Ctrl+Alt+F13 combination", () => {
      const result = parseKeyboardEventToShortcut({
        key: "F13",
        code: "F13",
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        metaKey: false,
      });

      assert.equal(result.isValid, true);
      assert.equal(result.shortcut, "Ctrl+Alt+F13");
      assert.equal(result.display, "Ctrl + Alt + F13");
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

    it("detects and flags internal shortcut conflicts", () => {
      const result = parseKeyboardEventToShortcut({
        key: "k",
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });

      assert.equal(result.isValid, false);
      assert.match(result.error || "", /Command Palette/i);
    });
  });

  describe("4. Shortcut String Validation", () => {
    it("validates valid accelerator strings", () => {
      assert.equal(isValidGlobalShortcut("Alt+Shift+K"), true);
      assert.equal(isValidGlobalShortcut("Ctrl+Space"), true);
      assert.equal(isValidGlobalShortcut("Ctrl+Alt+A"), true);
      assert.equal(isValidGlobalShortcut("Super+Shift+K"), true);
      assert.equal(isValidGlobalShortcut("Ctrl+Alt+F13"), true);
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

  describe("5. Conflict Detection & Replacement Safety", () => {
    it("identifies internal KeNote conflicts", () => {
      assert.equal(checkInternalShortcutConflict("Ctrl+K"), "Ctrl + K is already assigned to Command Palette in KeNote.");
      assert.equal(checkInternalShortcutConflict("Ctrl+N"), "Ctrl + N is already assigned to New Note in KeNote.");
      assert.equal(checkInternalShortcutConflict("Alt+Shift+K"), null);
    });

    it("preserves previous shortcut when registration fails", async () => {
      let registeredShortcut = "Alt+Shift+K";

      async function mockUpdateShortcut(newShortcut, shouldFail = false) {
        if (!isValidGlobalShortcut(newShortcut)) {
          throw new Error("Invalid shortcut");
        }
        const previous = registeredShortcut;
        if (shouldFail) {
          registeredShortcut = previous;
          throw new Error("Failed to register shortcut. Your existing shortcut remains active.");
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
      }, /remains active/i);

      assert.equal(registeredShortcut, "Ctrl+Space", "Previous shortcut must be preserved on failure");

      // Reset restores default
      const resReset = await mockUpdateShortcut(DEFAULT_GLOBAL_SHORTCUT, false);
      assert.equal(resReset, DEFAULT_GLOBAL_SHORTCUT);
      assert.equal(registeredShortcut, DEFAULT_GLOBAL_SHORTCUT);
    });
  });
});
