/**
 * Pure utility function to derive authoritative document statistics
 * (character count, word count, first-line title) from plain text.
 */
export function computeDocumentStats(text: string | null | undefined): {
  charCount: number;
  wordCount: number;
  firstLineTitle: string;
} {
  const charCount = text ? text.length : 0;
  const words = text && text.trim().length > 0 ? text.trim().split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  let firstLineTitle = "Untitled";
  if (text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      firstLineTitle = lines[0];
    }
  }

  return { charCount, wordCount, firstLineTitle };
}
