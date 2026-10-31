import { type AppSettings, DEFAULT_SETTINGS, type NoteMetadata } from "../types/note.ts";

// Detect if running inside Tauri
export const isTauri = () => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

// Strict URL protocol validation to prevent injection or malicious local execution
export function isValidExternalUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol.toLowerCase());
  } catch {
    if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(trimmed)) return true;
    if (/^tel:\+?[0-9\s\-()]+$/i.test(trimmed)) return true;
    return false;
  }
}

// Lazy load tauri invoke
async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(cmd, args);
  }
  throw new Error("Tauri not available");
}

// In-browser mock storage fallback
const STORAGE_KEY_NOTES = "kenote_notes_mock";
const STORAGE_KEY_SETTINGS = "kenote_settings_mock";
const STORAGE_KEY_AUTOSTART = "kenote_autostart_mock";
const STORAGE_KEY_AUTOSTART_LAUNCH = "kenote_autostart_launch_mock";
const STORAGE_KEY_ASSETS = "kenote_assets_mock";
const mockAssetsMap = new Map<string, string>();

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read blob as base64 string"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

const defaultMockNotes: NoteMetadata[] = [
  {
    id: "welcome",
    filename: "welcome.md",
    title: "Welcome to Kenote",
    content: `# Welcome to Kenote 🚀

Kenote is a minimal, local-first note-taking app inspired by Raycast.

### Quick Markdown Features:
- **Instant WYSIWYG**: Type \`# Heading\` or \`- list\` to format immediately!
- **Pin Window**: Click the pin icon in the top right to keep your notes on top of every app.
- **Local First**: Notes are saved directly as \`.md\` files in markdown format.

\`\`\`javascript
console.log("Hello from Kenote!");
\`\`\`

> "Simplicity is the soul of efficiency."

### Listings:
1. Ordered items
- Bulleted items
[ ] Task list checklist
`,
    updated_at: Math.floor(Date.now() / 1000),
    created_at: Math.floor(Date.now() / 1000),
    character_count: 360,
    is_pinned: true,
  },
];

let lastOpenedExternalUrl: string | null = null;
let lastOpenedExternalTime = 0;

export const api = {
  async getSettings(): Promise<AppSettings> {
    try {
      return await invokeTauri<AppSettings>("get_settings");
    } catch {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    if (isTauri()) {
      await invokeTauri("save_settings", { settings });
    } else {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    }
  },

  async updateGlobalShortcut(newShortcut: string): Promise<string> {
    if (isTauri()) {
      return await invokeTauri<string>("update_global_shortcut", { newShortcutStr: newShortcut });
    } else {
      const settings = await this.getSettings();
      const updated = { ...settings, global_shortcut: newShortcut };
      await this.saveSettings(updated);
      return newShortcut;
    }
  },

  async isAutostartEnabled(): Promise<boolean> {
    if (isTauri()) {
      return await invokeTauri<boolean>("is_autostart_enabled");
    }
    return localStorage.getItem(STORAGE_KEY_AUTOSTART) === "true";
  },

  async isAutostartLaunch(): Promise<boolean> {
    if (isTauri()) {
      try {
        return await invokeTauri<boolean>("get_is_autostart_launch");
      } catch (e) {
        console.error("Failed to check isAutostartLaunch:", e);
        return false;
      }
    }
    return localStorage.getItem(STORAGE_KEY_AUTOSTART_LAUNCH) === "true";
  },

  async setAutostartEnabled(enabled: boolean): Promise<boolean> {
    if (isTauri()) {
      if (enabled) {
        await invokeTauri("enable_autostart");
      } else {
        await invokeTauri("disable_autostart");
      }
      return await this.isAutostartEnabled();
    }
    localStorage.setItem(STORAGE_KEY_AUTOSTART, String(enabled));
    return enabled;
  },

  async getNotesDirectory(): Promise<string> {
    try {
      return await invokeTauri<string>("get_notes_directory");
    } catch {
      const settings = await this.getSettings();
      if (settings.custom_notes_dir && settings.custom_notes_dir.trim().length > 0) {
        return settings.custom_notes_dir.trim();
      }
      return "Local Browser Storage (AppData/Kenote/notes in desktop app)";
    }
  },

  async selectDirectory(defaultPath?: string): Promise<string | null> {
    if (isTauri()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          directory: true,
          multiple: false,
          defaultPath: defaultPath || undefined,
        });
        if (selected && typeof selected === "string") {
          return selected;
        }
        return null;
      } catch (e) {
        console.error("Failed to open directory selection dialog:", e);
        return null;
      }
    }
    return null;
  },

  async listNotes(): Promise<NoteMetadata[]> {
    try {
      return await invokeTauri<NoteMetadata[]>("list_notes");
    } catch {
      const stored = localStorage.getItem(STORAGE_KEY_NOTES);
      return stored ? JSON.parse(stored) : defaultMockNotes;
    }
  },

  async readNote(filename: string): Promise<NoteMetadata> {
    try {
      return await invokeTauri<NoteMetadata>("read_note", { filename });
    } catch {
      const list = await this.listNotes();
      const note = list.find((n) => n.filename === filename);
      if (!note) throw new Error("Note not found");
      return note;
    }
  },

  async saveNote(filename: string, content: string, is_pinned: boolean): Promise<NoteMetadata> {
    if (isTauri()) {
      return await invokeTauri<NoteMetadata>("save_note", { filename, content, isPinned: is_pinned });
    }
    const list = await this.listNotes();
    const extractTitle = (text: string) => {
      for (const line of text.split("\n")) {
        const t = line.trim();
        if (t) return t.replace(/^#+\s*/, "").trim();
      }
      return "Untitled";
    };

    const now = Math.floor(Date.now() / 1000);
    const title = extractTitle(content);
    const character_count = content.length;

    let targetNote = list.find((n) => n.filename === filename || n.id === filename);
    if (targetNote) {
      targetNote.content = content;
      targetNote.title = title;
      targetNote.updated_at = now;
      targetNote.character_count = character_count;
      targetNote.is_pinned = is_pinned;
    } else {
      const isAbsolute = filename.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(filename);
      const id = isAbsolute ? filename : `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newFilename = isAbsolute ? filename : `${id}.md`;
      targetNote = {
        id,
        filename: newFilename,
        title,
        content,
        updated_at: now,
        created_at: now,
        character_count,
        is_pinned,
        is_external: isAbsolute ? true : undefined,
        file_path: isAbsolute ? filename : undefined,
      };
      list.unshift(targetNote);
    }

    list.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || b.updated_at - a.updated_at);
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(list));
    return targetNote;
  },

  async openExternalNote(path: string): Promise<NoteMetadata> {
    if (isTauri()) {
      return await invokeTauri<NoteMetadata>("open_external_note", { path });
    }
    // Mock browser fallback
    const list = await this.listNotes();
    let note = list.find((n) => n.id === path || n.filename === path);
    if (!note) {
      note = {
        id: path,
        filename: path,
        title: path.split(/[/\\]/).pop()?.replace(/\.(md|markdown|txt)$/i, "") || "External Note",
        content: `# External Note\n\nOpened from: ${path}`,
        updated_at: Math.floor(Date.now() / 1000),
        created_at: Math.floor(Date.now() / 1000),
        character_count: 50,
        is_pinned: false,
        is_external: true,
        file_path: path,
      };
      list.unshift(note);
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(list));
    }
    return note;
  },

  async untrackExternalNote(path: string): Promise<void> {
    if (isTauri()) {
      await invokeTauri("untrack_external_note", { path });
      return;
    }
    let list = await this.listNotes();
    list = list.filter((n) => n.id !== path && n.filename !== path && n.file_path !== path);
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(list));
  },

  async selectMarkdownOrTextFile(): Promise<string | null> {
    if (isTauri()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          directory: false,
          multiple: false,
          filters: [
            {
              name: "Markdown & Text",
              extensions: ["md", "markdown", "txt"],
            },
          ],
        });
        if (selected && typeof selected === "string") {
          return selected;
        }
        return null;
      } catch (e) {
        console.error("Failed to pick markdown file via dialog:", e);
        return null;
      }
    }
    return null;
  },

  async setNotePinned(filename: string, is_pinned: boolean): Promise<void> {
    if (isTauri()) {
      await invokeTauri("set_note_pinned", { filename, isPinned: is_pinned });
      return;
    }
    const list = await this.listNotes();
    const targetNote = list.find((n) => n.filename === filename);
    if (targetNote) {
      targetNote.is_pinned = is_pinned;
      list.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || b.updated_at - a.updated_at);
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(list));
    }
  },

  async deleteNote(filename: string): Promise<void> {
    if (isTauri()) {
      await invokeTauri("delete_note", { filename });
      return;
    }
    let list = await this.listNotes();
    const trashed = list.find((n) => n.filename === filename || n.id === filename);
    list = list.filter((n) => n.filename !== filename && n.id !== filename);
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(list));

    if (trashed && !trashed.is_external) {
      const trashKey = "kenote_trash_mock";
      const trashList = JSON.parse(localStorage.getItem(trashKey) || "[]");
      trashList.unshift(trashed);
      localStorage.setItem(trashKey, JSON.stringify(trashList));
    }
  },

  async listTrashedNotes(): Promise<NoteMetadata[]> {
    if (isTauri()) {
      return await invokeTauri<NoteMetadata[]>("list_trashed_notes");
    }
    const trashKey = "kenote_trash_mock";
    return JSON.parse(localStorage.getItem(trashKey) || "[]");
  },

  async restoreNote(filename: string): Promise<NoteMetadata> {
    if (isTauri()) {
      return await invokeTauri<NoteMetadata>("restore_note", { filename });
    }
    const trashKey = "kenote_trash_mock";
    let trashList: NoteMetadata[] = JSON.parse(localStorage.getItem(trashKey) || "[]");
    const note = trashList.find((n) => n.filename === filename);
    if (!note) throw new Error("Trashed note not found");

    trashList = trashList.filter((n) => n.filename !== filename);
    localStorage.setItem(trashKey, JSON.stringify(trashList));

    let list = await this.listNotes();
    list.unshift(note);
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(list));
    return note;
  },

  async permanentlyDeleteNote(filename: string): Promise<void> {
    if (isTauri()) {
      await invokeTauri("permanently_delete_note", { filename });
      return;
    }
    const trashKey = "kenote_trash_mock";
    let trashList: NoteMetadata[] = JSON.parse(localStorage.getItem(trashKey) || "[]");
    trashList = trashList.filter((n) => n.filename !== filename);
    localStorage.setItem(trashKey, JSON.stringify(trashList));
  },

  async emptyTrash(): Promise<void> {
    if (isTauri()) {
      await invokeTauri("empty_trash");
      return;
    }
    localStorage.setItem("kenote_trash_mock", "[]");
  },

  async setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
    try {
      await invokeTauri("set_window_always_on_top", { alwaysOnTop });
    } catch (e) {
      console.log("Always on top:", alwaysOnTop, e);
    }
  },

  async showWindow(): Promise<void> {
    try {
      await invokeTauri("show_window");
    } catch (e) {
      console.log("Show window", e);
    }
  },

  async minimizeWindow(): Promise<void> {
    try {
      await invokeTauri("minimize_window");
    } catch (e) {
      console.log("Minimize window", e);
    }
  },

  async closeWindow(): Promise<void> {
    try {
      await invokeTauri("close_window");
    } catch (e) {
      console.log("Close window", e);
    }
  },

  async revealInExplorer(filename?: string): Promise<void> {
    try {
      await invokeTauri("reveal_in_explorer", { filename });
    } catch (e) {
      console.error("Failed to reveal in explorer:", e);
      throw e;
    }
  },

  async saveWindowState(): Promise<void> {
    try {
      await invokeTauri("save_window_state");
    } catch (e) {
      console.log("Save window state", e);
    }
  },

  async saveImageAttachment(fileOrBlob: Blob | File, preferredName?: string): Promise<string> {
    const base64Data = await blobToBase64(fileOrBlob);
    const filename = preferredName || (fileOrBlob instanceof File ? fileOrBlob.name : undefined);

    if (isTauri()) {
      return await invokeTauri<string>("save_image_attachment", {
        filename,
        base64Data,
      });
    }

    // Browser mock fallback
    const now = Date.now();
    const cleanName = (filename || "image").replace(/[^a-zA-Z0-9.-]/g, "_");
    const mockPath = `assets/${now}-${cleanName}`;
    mockAssetsMap.set(mockPath, base64Data);
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_ASSETS) || "{}");
      stored[mockPath] = base64Data;
      localStorage.setItem(STORAGE_KEY_ASSETS, JSON.stringify(stored));
    } catch {}
    return mockPath;
  },

  async resolveAssetUrl(src: string): Promise<string> {
    if (!src) return "";
    if (
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("data:") ||
      src.startsWith("blob:")
    ) {
      return src;
    }

    if (isTauri()) {
      try {
        return await invokeTauri<string>("read_image_attachment", { relativePath: src });
      } catch (err) {
        console.warn("Failed to read image attachment via Tauri:", src, err);
        return src;
      }
    }

    // Mock fallback
    if (mockAssetsMap.has(src)) {
      return mockAssetsMap.get(src)!;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_ASSETS) || "{}");
      if (stored[src]) return stored[src];
    } catch {}
    return src;
  },

  async selectImageFile(): Promise<File | null> {
    if (isTauri()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          directory: false,
          multiple: false,
          filters: [
            {
              name: "Image",
              extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"],
            },
          ],
        });
        if (selected && typeof selected === "string") {
          const { readFile } = await import("@tauri-apps/plugin-fs");
          const bytes = await readFile(selected);
          const filename = selected.split(/[\\/]/).pop() || "image.png";
          const ext = filename.split(".").pop()?.toLowerCase() || "png";
          const mime =
            ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "webp"
              ? "image/webp"
              : ext === "gif"
              ? "image/gif"
              : ext === "svg"
              ? "image/svg+xml"
              : "image/png";
          return new File([bytes], filename, { type: mime });
        }
        return null;
      } catch (e) {
        console.error("Failed to pick image via Tauri dialog:", e);
        return null;
      }
    }

    // Browser fallback
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = () => {
        const file = input.files?.[0] || null;
        resolve(file);
      };
      input.click();
    });
  },

  async saveFile(
    defaultFilename: string,
    content: string | Uint8Array,
    filters?: Array<{ name: string; extensions: string[] }>
  ): Promise<string | null> {
    if (isTauri()) {
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const selected = await save({
          defaultPath: defaultFilename,
          filters,
        });
        if (selected && typeof selected === "string") {
          const { writeTextFile, writeFile } = await import("@tauri-apps/plugin-fs");
          if (typeof content === "string") {
            await writeTextFile(selected, content);
          } else {
            await writeFile(selected, content);
          }
          return selected;
        }
        return null;
      } catch (err) {
        console.error("Failed to save file via Tauri dialog:", err);
        throw err;
      }
    }

    // Browser fallback: trigger file download via anchor
    try {
      const blob =
        typeof content === "string"
          ? new Blob([content], { type: "text/plain;charset=utf-8" })
          : new Blob([content as any]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return defaultFilename;
    } catch (err) {
      console.error("Failed to trigger browser download:", err);
      return null;
    }
  },

  async openExternal(url: string): Promise<boolean> {
    if (!isValidExternalUrl(url)) {
      console.warn("Blocked attempt to open invalid or unsafe external URL:", url);
      return false;
    }
    const now = Date.now();
    if (lastOpenedExternalUrl === url && now - lastOpenedExternalTime < 500) {
      return true;
    }
    lastOpenedExternalUrl = url;
    lastOpenedExternalTime = now;
    try {
      if (isTauri()) {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
        return true;
      } else if (typeof window !== "undefined" && typeof window.open === "function") {
        window.open(url, "_blank", "noopener,noreferrer");
        return true;
      }
      return true;
    } catch (e) {
      console.error("Failed to open external URL:", e);
      return false;
    }
  },
};
