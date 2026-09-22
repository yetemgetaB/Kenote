import type { Node } from "@tiptap/pm/model";
import { Selection, TextSelection } from "@tiptap/pm/state";

/**
 * Safely creates a ProseMirror selection guaranteed to point into an inline textblock.
 * If the provided positions point to non-inline boundaries (such as taskItem, taskList,
 * or doc root), TextSelection.findFrom is used to resolve to the nearest valid
 * inline text position, preventing RangeErrors, NodeSelection fallback, and corrupt DOM cursor states.
 */
export function createSafeSelection(
  doc: Node,
  rawFrom: number,
  rawTo?: number
): Selection | null {
  if (!doc || !doc.content || doc.content.size <= 0) return null;

  const minPos = Selection.atStart(doc).from;
  const maxPos = Selection.atEnd(doc).to;
  const clampedFrom = Math.min(Math.max(minPos, rawFrom), maxPos);
  const clampedTo = Math.min(Math.max(clampedFrom, rawTo ?? clampedFrom), maxPos);

  const $from = doc.resolve(clampedFrom);
  const $to = doc.resolve(clampedTo);

  // If both endpoints point directly into inline content, we can safely create TextSelection
  if ($from.parent.inlineContent && $to.parent.inlineContent) {
    return new TextSelection($from, $to);
  }

  // Otherwise, resolve to the nearest valid inline text selection
  const safeFromSel = TextSelection.findFrom($from, 1, true) || TextSelection.findFrom($from, -1, true);
  if (!safeFromSel) {
    return Selection.atStart(doc);
  }
  if (clampedFrom === clampedTo) {
    return safeFromSel;
  }
  const safeToSel = TextSelection.findFrom($to, 1, true) || TextSelection.findFrom($to, -1, true);
  if (!safeToSel) {
    return safeFromSel;
  }
  return new TextSelection(safeFromSel.$from, safeToSel.$to);
}
