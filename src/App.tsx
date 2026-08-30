import React, { useState, useEffect, useRef, useCallback } from "react";
import { Titlebar } from "./components/Titlebar";
import { Editor, EditorHandle } from "./components/Editor";
import { BottomToolbar } from "./components/BottomToolbar";
import { NoteSwitcher } from "./components/NoteSwitcher";
import { CommandPalette, ActionItem } from "./components/CommandPalette";
import { SettingsModal } from "./components/SettingsModal";
import { CustomInstaller } from "./components/CustomInstaller";
import { NoteMetadata, AppSettings } from "./types/note";
import { api } from "./utils/tauriBridge";
import { applyAccentColor } from "./utils/theme";
import {
  PlusIcon,
  NoteSwitcherIcon,
  PinIcon,
  CopyIcon,
  FolderIcon,
  SettingsIcon,
  TrashIcon,
} from "./components/Icons";

export function App() {
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [activeNote, setActiveNote] = useState<NoteMetadata | null>(null);
  const [activeTitle, setActiveTitle] = useState("Untitled");
  const [characterCount, setCharacterCount] = useState(0);
  const [settings, setSettings] = useState<AppSettings>({
    accent_color: "#0399F7",
    custom_notes_dir: null,
    font_size: "15px",
    font_family: "system-ui",
    line_height: "1.6",
    auto_save_interval: 500,
    always_on_top: false,
  });
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [notesDir, setNotesDir] = useState("");

  // Modals state
  const [isNoteSwitcherOpen, setIsNoteSwitcherOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInstallerOpen, setIsInstallerOpen] = useState(() => {
    return (
      new URLSearchParams(window.location.search).get("mode") === "install" ||
      new URLSearchParams(window.location.search).get("installer") === "true"
    );
  });

  // Editor refs
  const editorRef = useRef<EditorHandle>(null);
  const [tiptapInstance, setTiptapInstance] = useState<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial data
  useEffect(() => {
    async function init() {
      try {
        const loadedSettings = await api.getSettings();
        setSettings(loadedSettings);
        setIsAlwaysOnTop(loadedSettings.always_on_top);
        applyAccentColor(loadedSettings.accent_color);

        const dir = await api.getNotesDirectory();
        setNotesDir(dir);

        const loadedNotes = await api.listNotes();
        setNotes(loadedNotes);

        if (loadedNotes.length > 0) {
          const firstNote = loadedNotes[0];
          setActiveNote(firstNote);
          setActiveTitle(firstNote.title);
          setCharacterCount(firstNote.character_count);
        } else {
          // Create initial empty note
          handleNewNote();
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    init();
  }, []);

  // Save current note changes with debounce
  const handleEditorChange = useCallback(
    (markdown: string, charCount: number, firstLineTitle: string) => {
      setActiveTitle(firstLineTitle);
      setCharacterCount(charCount);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (!activeNote) return;

        try {
          const saved = await api.saveNote(
            activeNote.filename,
            markdown,
            activeNote.is_pinned
          );

          setActiveNote((prev) => (prev ? { ...prev, ...saved } : saved));

          // Update notes list in memory
          setNotes((prevNotes) => {
            const index = prevNotes.findIndex((n) => n.id === saved.id);
            let updated = [...prevNotes];
            if (index !== -1) {
              updated[index] = saved;
            } else {
              updated.unshift(saved);
            }
            return updated.sort(
              (a, b) =>
                (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
                b.updated_at - a.updated_at
            );
          });
        } catch (e) {
          console.error("Failed to save note:", e);
        }
      }, settings.auto_save_interval || 400);
    },
    [activeNote, settings.auto_save_interval]
  );

  // New Note
  const handleNewNote = async () => {
    try {
      const newNote = await api.saveNote("", "", false);
      setNotes((prev) => [newNote, ...prev]);
      setActiveNote(newNote);
      setActiveTitle("Untitled");
      setCharacterCount(0);
      setTimeout(() => editorRef.current?.focus(), 50);
    } catch (e) {
      console.error("Failed to create new note:", e);
    }
  };

  // Select Note
  const handleSelectNote = (note: NoteMetadata) => {
    setActiveNote(note);
    setActiveTitle(note.title);
    setCharacterCount(note.character_count);
    setTimeout(() => editorRef.current?.focus(), 50);
  };

  // Toggle Pin Note
  const handleTogglePinNote = async (note: NoteMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await api.saveNote(
        note.filename,
        note.content,
        !note.is_pinned
      );

      const refreshed = await api.listNotes();
      setNotes(refreshed);

      if (activeNote?.id === note.id) {
        setActiveNote(updated);
      }
    } catch (err) {
      console.error("Failed to toggle note pin:", err);
    }
  };

  // Delete Note
  const handleDeleteNote = async (note: NoteMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteNote(note.filename);
      const remaining = notes.filter((n) => n.filename !== note.filename);
      setNotes(remaining);

      if (activeNote?.filename === note.filename) {
        if (remaining.length > 0) {
          handleSelectNote(remaining[0]);
        } else {
          handleNewNote();
        }
      }
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  // Toggle Always on Top for the App Window
  const handleToggleAlwaysOnTop = async () => {
    const newState = !isAlwaysOnTop;
    setIsAlwaysOnTop(newState);
    await api.setAlwaysOnTop(newState);
    const updated = { ...settings, always_on_top: newState };
    setSettings(updated);
    await api.saveSettings(updated);
  };

  // Update Settings
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    applyAccentColor(newSettings.accent_color);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl or Cmd is pressed
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewNote();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setIsNoteSwitcherOpen((prev) => !prev);
        setIsCommandPaletteOpen(false);
        setIsSettingsOpen(false);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        setIsNoteSwitcherOpen(false);
        setIsSettingsOpen(false);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handleToggleAlwaysOnTop();
      } else if (isCmdOrCtrl && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
        setIsCommandPaletteOpen(false);
        setIsNoteSwitcherOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAlwaysOnTop, notes, activeNote, settings]);

  // Actions for Command Palette
  const actions: ActionItem[] = [
    {
      id: "new_note",
      title: "New Note",
      shortcut: ["Ctrl", "N"],
      icon: <PlusIcon size={16} />,
      perform: () => handleNewNote(),
    },
    {
      id: "browse_notes",
      title: "Browse Notes",
      shortcut: ["Ctrl", "O"],
      icon: <NoteSwitcherIcon size={16} />,
      perform: () => setIsNoteSwitcherOpen(true),
    },
    {
      id: "toggle_pin",
      title: isAlwaysOnTop ? "Unpin Window from Top" : "Pin Window on Top",
      shortcut: ["Ctrl", "P"],
      icon: <PinIcon size={16} filled={isAlwaysOnTop} />,
      perform: () => handleToggleAlwaysOnTop(),
    },
    {
      id: "copy_markdown",
      title: "Copy Note as Markdown",
      shortcut: ["Ctrl", "Shift", "C"],
      icon: <CopyIcon size={16} />,
      perform: () => {
        if (activeNote) {
          navigator.clipboard.writeText(activeNote.content);
        }
      },
    },
    {
      id: "copy_plain",
      title: "Copy Note as Plain Text",
      icon: <CopyIcon size={16} />,
      perform: () => {
        if (tiptapInstance) {
          navigator.clipboard.writeText(tiptapInstance.getText() || "");
        }
      },
    },
    {
      id: "open_folder",
      title: "Open Notes Folder in Explorer",
      icon: <FolderIcon size={16} />,
      perform: () => api.revealInExplorer(),
    },
    {
      id: "settings",
      title: "Settings...",
      shortcut: ["Ctrl", ","],
      icon: <SettingsIcon size={16} />,
      perform: () => setIsSettingsOpen(true),
    },
    {
      id: "delete_active_note",
      title: "Delete Current Note",
      icon: <TrashIcon size={16} className="text-red-400" />,
      perform: () => {
        if (activeNote) {
          handleDeleteNote(activeNote, {} as any);
        }
      },
    },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#16191E] text-[#E2E8F0] select-none overflow-hidden font-sans border border-[#262D38]/80 rounded-none shadow-2xl">
      {/* Titlebar Header */}
      <Titlebar
        title={activeTitle}
        isAlwaysOnTop={isAlwaysOnTop}
        onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenNoteSwitcher={() => setIsNoteSwitcherOpen(true)}
        onNewNote={handleNewNote}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onMinimize={() => api.minimizeWindow()}
        onClose={() => api.closeWindow()}
      />

      {/* Editor Body */}
      <main className="flex-1 flex flex-col min-h-0 bg-[#16191E] relative">
        <Editor
          ref={editorRef}
          initialContent={activeNote?.content || ""}
          onChange={handleEditorChange}
          fontSize={settings.font_size}
          lineHeight={settings.line_height}
          fontFamily={settings.font_family}
          onEditorReady={(editor) => setTiptapInstance(editor)}
        />
      </main>

      {/* Bottom Formatting Toolbar */}
      <BottomToolbar
        editor={tiptapInstance}
        characterCount={characterCount}
      />

      {/* Note Switcher Modal */}
      <NoteSwitcher
        isOpen={isNoteSwitcherOpen}
        notes={notes}
        activeNoteId={activeNote?.id || null}
        onSelectNote={handleSelectNote}
        onTogglePin={handleTogglePinNote}
        onDeleteNote={handleDeleteNote}
        onClose={() => setIsNoteSwitcherOpen(false)}
      />

      {/* Command Actions Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        actions={actions}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        notesDir={notesDir}
        onOpenInstaller={() => setIsInstallerOpen(true)}
      />

      {/* Custom Frameless Installer Wizard */}
      {isInstallerOpen && (
        <CustomInstaller
          onClose={() => setIsInstallerOpen(false)}
          onInstalled={() => setIsInstallerOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
