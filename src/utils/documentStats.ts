/**
 * Extracts only the first physical line as the note title.
 * The first newline (`\n` or `\r\n`) terminates the title.
 */
export function extractNoteTitle(content: string | null | undefined): string {
  if (!content) return "";
  const match = content.match(/^[^\r\n]*/);
  const rawFirstLine = match ? match[0] : "";
  return rawFirstLine.replace(/^#{1,6}\s*/, "").trim();
}

/**
 * Pure utility function to derive authoritative document statistics
 * (character count, word count, first-line title) from document text.
 */
export function computeDocumentStats(
  text: string | null | undefined,
  visibleCharCount?: number
): {
  charCount: number;
  wordCount: number;
  firstLineTitle: string;
} {
  const charCount = typeof visibleCharCount === "number" ? visibleCharCount : (text ? text.length : 0);
  const words = text && text.trim().length > 0 ? text.trim().split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  const rawTitle = extractNoteTitle(text);
  const firstLineTitle = rawTitle.length > 0 ? rawTitle : "Untitled";

  return { charCount, wordCount, firstLineTitle };
}

/**
 * Determines whether a note's on-disk `updated_at` timestamp (in Unix seconds)
 * represents a newer external modification compared to the active in-memory timestamp.
 * Uses a 2-second grace threshold to avoid reloading from local save jitter.
 */
export function hasExternalUpdate(
  diskUpdatedAt: number,
  localUpdatedAt: number,
  thresholdSeconds = 2
): boolean {
  if (!Number.isFinite(diskUpdatedAt) || !Number.isFinite(localUpdatedAt)) {
    return false;
  }
  return diskUpdatedAt > localUpdatedAt + thresholdSeconds;
}

/**
 * Formats a Unix-second timestamp into a concise relative string (e.g. "5m ago").
 */
export function formatRelativeTimestamp(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString();
}
