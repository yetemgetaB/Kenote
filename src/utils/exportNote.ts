import type { Editor as TiptapEditor } from "@tiptap/react";
import { api, isTauri } from "./tauriBridge.ts";
import type { NoteMetadata } from "../types/note.ts";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeFilename(name: string, fallback = "Untitled"): string {
  const sanitized = name.trim().replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ");
  return sanitized.length > 0 ? sanitized : fallback;
}

export function generateStandaloneHtml(title: string, bodyHtml: string): string {
  const safeTitle = escapeHtml(title || "KeNote Document");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #16191E;
      --card-bg: #1E242E;
      --text: #D8E1E8;
      --text-muted: #94A3B8;
      --border: #2A3240;
      --accent: #0399F7;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #FAFAFA;
        --card-bg: #FFFFFF;
        --text: #1F2937;
        --text-muted: #64748B;
        --border: #E2E8F0;
        --accent: #0284C7;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.65;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 24px;
      background-color: var(--bg);
      color: var(--text);
    }
    h1, h2, h3, h4 { color: var(--text); line-height: 1.3; margin-top: 1.5em; margin-bottom: 0.5em; }
    h1 { font-size: 2em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.2em; }
    p, ul, ol { margin: 1em 0; }
    ul, ol { padding-left: 24px; }
    li { margin: 0.3em 0; }
    hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
    blockquote {
      border-left: 4px solid var(--accent);
      padding: 8px 16px;
      margin: 1.5em 0;
      color: var(--text-muted);
      background: var(--card-bg);
      border-radius: 0 8px 8px 0;
    }
    pre {
      background: #111827;
      color: #E2E8F0;
      padding: 14px 18px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
      border: 1px solid var(--border);
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.88em;
      background: rgba(148, 163, 184, 0.15);
      padding: 2px 5px;
      border-radius: 4px;
    }
    pre code { background: transparent; padding: 0; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1.5em 0;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 8px 14px;
      text-align: left;
    }
    th {
      background: var(--card-bg);
      font-weight: 600;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1em 0;
      border: 1px solid var(--border);
    }
    a { color: var(--accent); text-decoration: underline; }
    .task-list { list-style: none; padding-left: 0; }
    .task-list-item { display: flex; align-items: baseline; gap: 8px; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  ${bodyHtml}
</body>
</html>`;
}

export function exportToPdf(): void {
  window.print();
}

export async function exportToHtml(title: string, bodyHtml: string): Promise<string | null> {
  const safeName = `${sanitizeFilename(title)}.html`;
  const htmlContent = generateStandaloneHtml(title, bodyHtml);
  return await api.saveFile(safeName, htmlContent, [
    { name: "HTML Document", extensions: ["html"] },
  ]);
}

export async function exportToMarkdown(title: string, markdown: string): Promise<string | null> {
  const safeName = `${sanitizeFilename(title)}.md`;
  return await api.saveFile(safeName, markdown, [
    { name: "Markdown Document", extensions: ["md"] },
  ]);
}

export async function exportToPlainText(title: string, plainText: string): Promise<string | null> {
  const safeName = `${sanitizeFilename(title)}.txt`;
  return await api.saveFile(safeName, plainText, [
    { name: "Text Document", extensions: ["txt"] },
  ]);
}

export async function copyRichText(editor: TiptapEditor): Promise<boolean> {
  const html = editor.getHTML();
  const text = editor.getText();
  try {
    const htmlBlob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([text], { type: "text/plain" });
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      }),
    ]);
    return true;
  } catch (err) {
    console.warn("ClipboardItem write failed, falling back to plain text:", err);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

export async function exportAllNotesToFolder(
  notes: NoteMetadata[]
): Promise<{ count: number } | null> {
  if (isTauri()) {
    const selected = await api.selectDirectory();
    if (!selected) return null;

    try {
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      let count = 0;
      for (const note of notes) {
        const safeName = `${sanitizeFilename(note.title || note.filename.replace(/\.md$/, ""))}.md`;
        const destPath = `${selected}/${safeName}`;
        await writeTextFile(destPath, note.content || "");
        count++;
      }
      return { count };
    } catch (err) {
      console.error("Failed to export all notes to folder:", err);
      throw err;
    }
  }

  // Browser fallback: trigger bulk downloads
  let count = 0;
  for (const note of notes) {
    const safeName = `${sanitizeFilename(note.title || note.filename.replace(/\.md$/, ""))}.md`;
    await api.saveFile(safeName, note.content || "");
    count++;
  }
  return { count };
}
