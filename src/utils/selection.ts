import type { Node } from "@tiptap/pm/model";
import { Selection, TextSelection } from "@tiptap/pm/state";

/**
 * Safely creates a ProseMirror selection guaranteed to point into an inline textblock.
 * If the provided positions point to non-inline boundaries (such as taskItem, taskList,
 * or doc root), ProseMirror's Selection.near is used to resolve to the nearest valid
 * inline text position, preventing RangeErrors and corrupt DOM cursor states.
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

  // Otherwise, use ProseMirror's Selection.near to resolve to the nearest valid inline selection
  const safeFromSel = Selection.near($from, 1);
  if (clampedFrom === clampedTo) {
    return safeFromSel;
  }
  const safeToSel = Selection.near($to, 1);
  return new TextSelection(safeFromSel.$from, safeToSel.$to);
}
