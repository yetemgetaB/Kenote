import type { NoteMetadata } from "../types/note.ts";

/**
 * Regex for matching tags in non-code text blocks.
 * Matches #tag where tag starts with a letter or underscore,
 * followed by alphanumeric characters, underscores, hyphens, or slashes.
 */
export const TAG_PATTERN = /(?:^|[\s(\[{])#([a-zA-Z_][a-zA-Z0-9_\-/]*)(?=[\s)\]},.;:!?]|$)/g;

/**
 * Extract unique, lowercase tags from raw Markdown content,
 * automatically ignoring fenced code blocks, inline code, and heading markers.
 */
export function extractTagsFromMarkdown(content: string): string[] {
  if (!content) return [];

  const tags: string[] = [];
  const lines = content.split(/\r?\n/);
  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      continue;
    }

    // Strip leading markdown heading tokens, e.g. "### Heading" -> "Heading"
    let lineToScan = line;
    const trimmedStart = line.trimStart();
    if (trimmedStart.startsWith("#")) {
      const matchHeading = trimmedStart.match(/^(#{1,6})\s/);
      if (matchHeading) {
        const offset = line.length - trimmedStart.length + matchHeading[1].length;
        lineToScan = line.slice(offset);
      }
    }

    // Split by backtick to ignore inline code segments
    const segments = lineToScan.split("`");
    for (let i = 0; i < segments.length; i++) {
      if (i % 2 === 1) {
        // Inside inline code
        continue;
      }

      const segment = segments[i];
      // Reset regex state
      const regex = new RegExp(TAG_PATTERN.source, "g");
      let match: RegExpExecArray | null;
      while ((match = regex.exec(segment)) !== null) {
        const tag = match[1].toLowerCase();
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      }
    }
  }

  return tags;
}

export interface TagCount {
  tag: string;
  count: number;
}

/**
 * Aggregates all unique tags across an array of notes,
 * returning tags sorted by occurrence count descending, then alphabetically.
 */
export function getAllUniqueTags(notes: NoteMetadata[]): TagCount[] {
  const countMap = new Map<string, number>();

  for (const note of notes) {
    const noteTags = note.tags && note.tags.length > 0
      ? note.tags
      : extractTagsFromMarkdown(note.content || "");

    const seenInNote = new Set<string>();
    for (const t of noteTags) {
      const lower = t.toLowerCase();
      if (!seenInNote.has(lower)) {
        seenInNote.add(lower);
        countMap.set(lower, (countMap.get(lower) || 0) + 1);
      }
    }
  }

  const result: TagCount[] = Array.from(countMap.entries()).map(([tag, count]) => ({
    tag,
    count,
  }));

  // Sort by count descending, then alphabetically
  return result.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.tag.localeCompare(b.tag);
  });
}

/**
 * Filters notes based on a selected tag identifier (without '#').
 */
export function filterNotesByTag(
  notes: NoteMetadata[],
  selectedTag: string | null
): NoteMetadata[] {
  if (!selectedTag) return notes;
  const target = selectedTag.toLowerCase().replace(/^#/, "");

  return notes.filter((note) => {
    const noteTags = note.tags && note.tags.length > 0
      ? note.tags
      : extractTagsFromMarkdown(note.content || "");

    return noteTags.some((t) => t.toLowerCase() === target);
  });
}
