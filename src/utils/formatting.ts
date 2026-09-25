import type { Editor as TiptapEditor } from "@tiptap/core";
import { createSafeSelection } from "./selection.ts";

export type SmartMarkType = "bold" | "italic" | "underline";

/**
 * Smart Mark helper: toggles formatting on the word around the cursor or on existing selection.
 * If selection is non-empty, standard mark toggling is applied to the selection.
 * If selection is collapsed:
 *   - If cursor is inside a word, toggles the mark on the full word and preserves the cursor position.
 *   - If cursor is outside a word (e.g. at whitespace or line boundary), toggles the mark for subsequent typing.
 */
export function toggleSmartMark(editor: TiptapEditor | null, markType: SmartMarkType): boolean {
  if (!editor || editor.isDestroyed) return false;

  const { state, dispatch } = editor.view;
  const { selection, schema } = state;
  const mark = schema.marks[markType];
  if (!mark) return false;

  // 1. If selection is not empty, toggle mark on the selection normally
  if (!selection.empty) {
    if (markType === "bold") return editor.commands.toggleBold();
    if (markType === "italic") return editor.commands.toggleItalic();
    if (markType === "underline") return editor.commands.toggleUnderline();
    return false;
  }

  // 2. Collapsed selection (cursor). Inspect word around cursor
  const { $from } = selection;
  const parent = $from.parent;
  if (!parent.isTextblock) {
    if (markType === "bold") return editor.commands.toggleBold();
    if (markType === "italic") return editor.commands.toggleItalic();
    if (markType === "underline") return editor.commands.toggleUnderline();
    return false;
  }

  const text = parent.textContent;
  const offset = $from.parentOffset;

  const isWordChar = (char: string | undefined): boolean => {
    if (!char) return false;
    return /[\p{L}\p{N}_]/u.test(char);
  };

  const isAtWord = isWordChar(text[offset]) || (offset > 0 && isWordChar(text[offset - 1]));
  if (!isAtWord) {
    if (markType === "bold") return editor.commands.toggleBold();
    if (markType === "italic") return editor.commands.toggleItalic();
    if (markType === "underline") return editor.commands.toggleUnderline();
    return false;
  }

  // Scan backwards to word start
  let start = offset;
  if (!isWordChar(text[start]) && start > 0 && isWordChar(text[start - 1])) {
    start = start - 1;
  }
  while (start > 0 && isWordChar(text[start - 1])) {
    start--;
  }

  // Scan forwards to word end
  let end = offset;
  if (isWordChar(text[end])) {
    while (end < text.length && isWordChar(text[end])) {
      end++;
    }
  } else if (offset > 0 && isWordChar(text[offset - 1])) {
    end = offset;
  }

  if (start >= end) {
    if (markType === "bold") return editor.commands.toggleBold();
    if (markType === "italic") return editor.commands.toggleItalic();
    if (markType === "underline") return editor.commands.toggleUnderline();
    return false;
  }

  const from = $from.start() + start;
  const to = $from.start() + end;
  const isCurrentlyActive = state.doc.rangeHasMark(from, to, mark);

  const tr = state.tr;
  if (isCurrentlyActive) {
    tr.removeMark(from, to, mark);
  } else {
    tr.addMark(from, to, mark.create());
  }

  // Preserve cursor position
  const currentPos = $from.pos;
  const clampedPos = Math.min(Math.max(from, currentPos), to);
  const safeSel = createSafeSelection(tr.doc, clampedPos, clampedPos);
  if (safeSel) {
    tr.setSelection(safeSel);
  }

  dispatch(tr);
  return true;
}

export function toggleSmartBold(editor: TiptapEditor | null): boolean {
  return toggleSmartMark(editor, "bold");
}

export function toggleSmartItalic(editor: TiptapEditor | null): boolean {
  return toggleSmartMark(editor, "italic");
}

export function toggleSmartUnderline(editor: TiptapEditor | null): boolean {
  return toggleSmartMark(editor, "underline");
}

/**
 * Clear Formatting helper:
 * - Non-empty selection: Removes all schema-defined inline marks (bold, italic, underline, strike, code, link)
 *   from the selected range without modifying structural nodes or deleting text.
 * - Collapsed selection: Clears stored marks so upcoming typed text is unformatted,
 *   without expanding selection or altering existing document text.
 */
export function clearFormatting(editor: TiptapEditor | null): boolean {
  if (!editor || editor.isDestroyed) return false;

  const { state, dispatch } = editor.view;
  const { selection, schema } = state;

  if (selection.empty) {
    const tr = state.tr.setStoredMarks([]);
    dispatch(tr);
    return true;
  }

  const { from, to } = selection;
  const tr = state.tr;

  // Schema-aware explicit removal of all registered inline marks
  Object.values(schema.marks).forEach((markType) => {
    tr.removeMark(from, to, markType);
  });

  // Preserve selection range safely
  const safeSel = createSafeSelection(tr.doc, from, to);
  if (safeSel) {
    tr.setSelection(safeSel);
  }

  dispatch(tr);
  return true;
}

/**
 * Checks if the selection or active state has any formatting marks applied.
 */
export function hasFormatting(editor: TiptapEditor | null): boolean {
  if (!editor || editor.isDestroyed) return false;

  const { state } = editor.view;
  const { selection, schema } = state;

  if (selection.empty) {
    const stored = state.storedMarks;
    if (stored && stored.length > 0) return true;
    return selection.$from.marks().length > 0;
  }

  const { from, to } = selection;
  return Object.values(schema.marks).some((markType) => state.doc.rangeHasMark(from, to, markType));
}

