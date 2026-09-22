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
