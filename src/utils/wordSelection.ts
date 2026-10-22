import type { Node } from "@tiptap/pm/model";

export interface WordRange {
  from: number;
  to: number;
  word: string;
}

/**
 * Determines whether a character should be considered part of a word.
 * Includes Unicode letters, numbers, and internal connectors like apostrophes and hyphens.
 */
function isWordChar(char: string): boolean {
  return /[\p{L}\p{N}'’_-]/u.test(char);
}

/**
 * Finds the range and text of a word at a specific document position.
 * Returns null if the position is not within or adjacent to a word (e.g. whitespace, blank line).
 */
export function findWordRangeAtPos(doc: Node, pos: number): WordRange | null {
  if (!doc || !doc.content || doc.content.size <= 0) return null;

  const clampedPos = Math.min(Math.max(0, pos), doc.content.size);
  const $pos = doc.resolve(clampedPos);
  const parent = $pos.parent;

  if (!parent.isTextblock) return null;

  const text = parent.textContent;
  if (!text || text.length === 0) return null;

  const parentStart = $pos.start();
  const offset = $pos.parentOffset;

  let checkOffset = offset;
  // If cursor is at or after boundary, check if the character immediately preceding is a word char
  if (checkOffset >= text.length || !isWordChar(text[checkOffset])) {
    if (checkOffset > 0 && isWordChar(text[checkOffset - 1])) {
      checkOffset = checkOffset - 1;
    } else {
      return null;
    }
  }

  // Scan left
  let startOffset = checkOffset;
  while (startOffset > 0 && isWordChar(text[startOffset - 1])) {
    startOffset--;
  }

  // Scan right
  let endOffset = checkOffset;
  while (endOffset < text.length && isWordChar(text[endOffset])) {
    endOffset++;
  }

  // Trim leading/trailing punctuation characters like single quotes, hyphens, underscores
  while (startOffset < endOffset && /^['’_-]/.test(text[startOffset])) {
    startOffset++;
  }
  while (endOffset > startOffset && /['’_-]$/.test(text[endOffset - 1])) {
    endOffset--;
  }

  if (startOffset >= endOffset) return null;

  const word = text.slice(startOffset, endOffset);
  if (!word || word.trim().length === 0) return null;

  // Accurately map offsets in parent.textContent to ProseMirror document positions,
  // taking any non-text inline children into account.
  let currentOffset = 0;
  let from = parentStart + startOffset;
  let to = parentStart + endOffset;
  let foundStart = false;

  parent.forEach((childNode, nodeOffset) => {
    if (childNode.isText) {
      const textLen = childNode.text?.length || 0;
      if (!foundStart && currentOffset + textLen >= startOffset) {
        from = parentStart + nodeOffset + (startOffset - currentOffset);
        foundStart = true;
      }
      if (foundStart && currentOffset + textLen >= endOffset) {
        to = parentStart + nodeOffset + (endOffset - currentOffset);
      }
      currentOffset += textLen;
    } else {
      currentOffset += childNode.nodeSize;
    }
  });

  return {
    from,
    to,
    word,
  };
}
