import type { AppSettings, NoteMetadata } from "../types/note.ts";

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

const defaultSettings: AppSettings = {
  accent_color: "#0399F7",
  custom_notes_dir: null,
  font_size: "15px",
  font_family: "system-ui",
  line_height: "1.6",
  auto_save_interval: 500,
  always_on_top: false,
};

let lastOpenedExternalUrl: string | null = null;
let lastOpenedExternalTime = 0;

export const api = {
  async getSettings(): Promise<AppSettings> {
    try {
      return await invokeTauri<AppSettings>("get_settings");
    } catch {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return stored ? JSON.parse(stored) : defaultSettings;
    }
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    if (isTauri()) {
      await invokeTauri("save_settings", { settings });
    } else {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    }
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

    let targetNote = list.find((n) => n.filename === filename);
    if (targetNote) {
      targetNote.content = content;
      targetNote.title = title;
      targetNote.updated_at = now;
      targetNote.character_count = character_count;
      targetNote.is_pinned = is_pinned;
    } else {
      const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newFilename = `${id}.md`;
      targetNote = {
        id,
        filename: newFilename,
        title,
        content,
        updated_at: now,
        created_at: now,
        character_count,
        is_pinned,
      };
      list.unshift(targetNote);
    }

    list.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || b.updated_at - a.updated_at);
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(list));
    return targetNote;
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
    const trashed = list.find((n) => n.filename === filename);
    list = list.filter((n) => n.filename !== filename);
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(list));

    if (trashed) {
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

  async downloadAndRunInstaller(downloadUrl: string): Promise<void> {
    try {
      await invokeTauri("download_and_run_installer", { downloadUrl });
    } catch (e) {
      console.warn("Desktop installer download failed, opening browser fallback:", e);
      await this.openExternal(downloadUrl);
      throw e;
    }
  },
};
