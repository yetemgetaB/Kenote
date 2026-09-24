/**
 * Keyboard shortcut utilities for parsing, normalizing, and validating
 * global shortcuts compatible with Tauri's Shortcut accelerator format.
 */

export interface ParsedShortcutResult {
  shortcut: string | null;
  display: string;
  isModifierOnly: boolean;
  isEscape: boolean;
  isValid: boolean;
  error?: string;
}

export const DEFAULT_GLOBAL_SHORTCUT = "Alt+Shift+K";

/**
 * Normalizes a keyboard event key/code to a standard Tauri-compatible key identifier.
 */
export function normalizeKey(key: string, code?: string): string | null {
  if (!key) return null;

  // Ignore bare modifier keypresses
  if (["Control", "Shift", "Alt", "Meta", "OS", "AltGraph"].includes(key)) {
    return null;
  }

  // Handle Space
  if (key === " " || key === "Space" || code === "Space") {
    return "Space";
  }

  // Handle Function keys F1-F24
  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(key)) {
    return key.toUpperCase();
  }

  // Handle single alphanumeric characters
  if (key.length === 1 && /^[a-zA-Z0-9]$/.test(key)) {
    return key.toUpperCase();
  }

  // Handle navigation & editing keys
  const specialKeyMap: Record<string, string> = {
    Enter: "Enter",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    Insert: "Insert",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    Escape: "Escape",
  };

  if (specialKeyMap[key]) {
    return specialKeyMap[key];
  }

  // Handle punctuation/symbol codes if available
  if (code) {
    const codeMap: Record<string, string> = {
      Minus: "Minus",
      Equal: "Equal",
      BracketLeft: "BracketLeft",
      BracketRight: "BracketRight",
      Backslash: "Backslash",
      Semicolon: "Semicolon",
      Quote: "Quote",
      Backquote: "Backquote",
      Comma: "Comma",
      Period: "Period",
      Slash: "Slash",
    };
    if (codeMap[code]) {
      return codeMap[code];
    }
  }

  return key.length === 1 ? key.toUpperCase() : key;
}

/**
 * Parses a native KeyboardEvent into a normalized Tauri global shortcut string (e.g., "Alt+Shift+K").
 */
export function parseKeyboardEventToShortcut(e: KeyboardEvent | {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}): ParsedShortcutResult {
  if (e.key === "Escape") {
    return {
      shortcut: null,
      display: "Escape",
      isModifierOnly: false,
      isEscape: true,
      isValid: false,
    };
  }

  const isModKey = ["Control", "Shift", "Alt", "Meta", "OS", "AltGraph"].includes(e.key);

  const modifiers: string[] = [];
  if (e.ctrlKey) modifiers.push("Ctrl");
  if (e.altKey) modifiers.push("Alt");
  if (e.shiftKey) modifiers.push("Shift");
  if (e.metaKey) modifiers.push("Super");

  if (isModKey || modifiers.length === 0 && !e.key) {
    return {
      shortcut: null,
      display: modifiers.length > 0 ? modifiers.join(" + ") : "",
      isModifierOnly: true,
      isEscape: false,
      isValid: false,
    };
  }

  const baseKey = normalizeKey(e.key, e.code);

  if (!baseKey) {
    return {
      shortcut: null,
      display: modifiers.join(" + "),
      isModifierOnly: true,
      isEscape: false,
      isValid: false,
    };
  }

  // Global shortcuts must include at least one modifier key
  if (modifiers.length === 0) {
    return {
      shortcut: null,
      display: baseKey,
      isModifierOnly: false,
      isEscape: false,
      isValid: false,
      error: "Shortcut must include at least one modifier (Ctrl, Alt, Shift, or Win).",
    };
  }

  const shortcutString = `${modifiers.join("+")}+${baseKey}`;
  const displayString = `${modifiers.join(" + ")} + ${baseKey}`;

  return {
    shortcut: shortcutString,
    display: displayString,
    isModifierOnly: false,
    isEscape: false,
    isValid: true,
  };
}

/**
 * Validates whether a shortcut string has a valid structure.
 */
export function isValidGlobalShortcut(shortcut?: string | null): boolean {
  if (!shortcut || typeof shortcut !== "string") return false;
  const parts = shortcut.trim().split("+");
  if (parts.length < 2) return false;

  const validModifiers = new Set(["Ctrl", "Control", "Alt", "Shift", "Super", "CommandOrControl", "CmdOrCtrl"]);
  let hasModifier = false;
  let hasKey = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) return false;
    if (validModifiers.has(part)) {
      hasModifier = true;
    } else {
      hasKey = true;
    }
  }

  return hasModifier && hasKey;
}

/**
 * Formats a shortcut string (e.g., "Alt+Shift+K") into a clean display representation ("Alt + Shift + K").
 */
export function formatShortcutDisplay(shortcut?: string | null): string {
  if (!shortcut || typeof shortcut !== "string") {
    return "Alt + Shift + K";
  }
  return shortcut.replace(/\+/g, " + ");
}
