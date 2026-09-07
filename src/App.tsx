import React, { useState, useEffect, useRef, useCallback } from "react";
import { Titlebar } from "./components/Titlebar";
import { Editor, EditorHandle } from "./components/Editor";
import { BottomToolbar } from "./components/BottomToolbar";
import { NoteSwitcher } from "./components/NoteSwitcher";
import { QuickSwitcherOverlay } from "./components/QuickSwitcherOverlay";
import { CommandPalette, ActionItem } from "./components/CommandPalette";
import { SettingsModal } from "./components/SettingsModal";
import { WelcomeModal } from "./components/WelcomeModal";
import { NoteMetadata, AppSettings } from "./types/note";
import { api } from "./utils/tauriBridge";
import { applyAccentColor } from "./utils/theme";
import { trackAppLaunch } from "./utils/analytics";
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
    quick_switcher_mode: "overlay",
    quick_switcher_order: "mru",
    quick_switcher_shortcut: "ctrl_tab",
  });
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [notesDir, setNotesDir] = useState("");

  // MRU Note history
  const [recentNoteIds, setRecentNoteIds] = useState<string[]>([]);

  // Modals state
  const [isNoteSwitcherOpen, setIsNoteSwitcherOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);

  // Quick Switcher HUD state
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);
  const [quickSwitcherIndex, setQuickSwitcherIndex] = useState(0);
  const isQuickSwitcherOpenRef = useRef(false);
  const quickSwitcherIndexRef = useRef(0);
  const quickSwitcherNotesRef = useRef<NoteMetadata[]>([]);

  // Toast / Undo notification state
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    undoNote?: NoteMetadata | null;
  }>({ visible: false, message: "", undoNote: null });
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

        if (!loadedSettings.has_completed_onboarding) {
          setIsWelcomeOpen(true);
        }

        trackAppLaunch("0.2.0");

        const dir = await api.getNotesDirectory();
        setNotesDir(dir);

        const loadedNotes = await api.listNotes();
        setNotes(loadedNotes);

        const startupMode = loadedSettings.startup_behavior || "last";

        if (loadedNotes.length > 0) {
          let targetNote: NoteMetadata | undefined;

          if (startupMode === "new") {
            // User requested to open a brand new note on launch
            await handleNewNote();
            return;
          } else if (startupMode === "specific" && loadedSettings.startup_specific_note_id) {
            targetNote = loadedNotes.find(
              (n) => n.id === loadedSettings.startup_specific_note_id
            );
          } else if (startupMode === "last" && loadedSettings.last_active_note_id) {
            targetNote = loadedNotes.find(
              (n) => n.id === loadedSettings.last_active_note_id
            );
          }

          // Fallback to first available note if specific/last wasn't found
          if (!targetNote) {
            targetNote = loadedNotes[0];
          }

          setActiveNote(targetNote);
          setActiveTitle(targetNote.title);
          setCharacterCount(targetNote.character_count);
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

      // Track last active note in settings
      const updated = { ...settings, last_active_note_id: newNote.id };
      setSettings(updated);
      api.saveSettings(updated);

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

    // Update MRU list
    setRecentNoteIds((prev) => [note.id, ...prev.filter((id) => id !== note.id)]);

    // Track last active note in settings
    const updated = { ...settings, last_active_note_id: note.id };
    setSettings(updated);
    api.saveSettings(updated);

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

  // Delete Note (move to trash)
  const handleDeleteNote = async (note: NoteMetadata, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.deleteNote(note.filename);
      const remaining = notes.filter((n) => n.filename !== note.filename);
      setNotes(remaining);
      setRecentNoteIds((prev) => prev.filter((id) => id !== note.id));

      if (activeNote?.filename === note.filename) {
        if (remaining.length > 0) {
          handleSelectNote(remaining[0]);
        } else {
          handleNewNote();
        }
      }

      // Show Undo Toast
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      setToast({
        visible: true,
        message: `Moved "${note.title || "Untitled"}" to Trash`,
        undoNote: note,
      });
      toastTimeoutRef.current = setTimeout(() => {
        setToast({ visible: false, message: "", undoNote: null });
      }, 5000);
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  // Restore Note from Trash
  const handleRestoreNote = (restoredNote: NoteMetadata) => {
    setNotes((prev) => {
      const exists = prev.some((n) => n.id === restoredNote.id);
      if (exists) return prev;
      const updated = [restoredNote, ...prev];
      return updated.sort(
        (a, b) =>
          (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
          b.updated_at - a.updated_at
      );
    });
    handleSelectNote(restoredNote);
  };

  // Undo Delete
  const handleUndoDelete = async () => {
    if (!toast.undoNote) return;
    try {
      const restored = await api.restoreNote(toast.undoNote.filename);
      handleRestoreNote(restored);
      setToast({ visible: false, message: "", undoNote: null });
    } catch (err) {
      console.error("Failed to undo delete:", err);
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

  // Prepare ordered notes for Quick Switcher (MRU or Default list order)
  const getOrderedNotes = useCallback(() => {
    if (settings.quick_switcher_order === "pinned_updated") {
      return notes;
    }
    // MRU Order
    const mruNotes: NoteMetadata[] = [];
    const notesMap = new Map(notes.map((n) => [n.id, n]));

    for (const id of recentNoteIds) {
      const note = notesMap.get(id);
      if (note) {
        mruNotes.push(note);
        notesMap.delete(id);
      }
    }
    // Add any remaining notes not yet in MRU history
    for (const remaining of notesMap.values()) {
      mruNotes.push(remaining);
    }
    return mruNotes;
  }, [notes, recentNoteIds, settings.quick_switcher_order]);

  // Global Keyboard Shortcuts & Quick Switcher modifier release
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const shortcutConfig = settings.quick_switcher_shortcut || "ctrl_tab";
      const switcherMode = settings.quick_switcher_mode || "overlay";

      // 1. Check if quick switcher shortcut key is pressed
      let isSwitcherShortcut = false;
      if (switcherMode !== "disabled") {
        if (shortcutConfig === "ctrl_tab" && isCmdOrCtrl && e.key === "Tab") {
          isSwitcherShortcut = true;
        } else if (shortcutConfig === "alt_tab" && isAlt && e.key === "Tab") {
          isSwitcherShortcut = true;
        } else if (
          shortcutConfig === "ctrl_pagedown" &&
          isCmdOrCtrl &&
          (e.key === "PageDown" || e.key === "PageUp")
        ) {
          isSwitcherShortcut = true;
        }
      }

      if (isSwitcherShortcut && notes.length > 1) {
        e.preventDefault();

        const ordered = getOrderedNotes();
        quickSwitcherNotesRef.current = ordered;

        if (switcherMode === "instant") {
          const currentIndex = ordered.findIndex((n) => n.id === activeNote?.id);
          const isReverse = e.shiftKey || e.key === "PageUp";
          let nextIdx = 0;
          if (isReverse) {
            nextIdx = currentIndex > 0 ? currentIndex - 1 : ordered.length - 1;
          } else {
            nextIdx = currentIndex >= 0 && currentIndex < ordered.length - 1 ? currentIndex + 1 : 0;
          }
          if (ordered[nextIdx]) {
            handleSelectNote(ordered[nextIdx]);
          }
          return;
        }

        // Overlay Mode
        const isReverse = e.shiftKey || e.key === "PageUp";
        if (!isQuickSwitcherOpenRef.current) {
          // Open overlay, start at second item (the last visited note in MRU) or first
          isQuickSwitcherOpenRef.current = true;
          setIsQuickSwitcherOpen(true);
          const startIdx = isReverse ? ordered.length - 1 : Math.min(1, ordered.length - 1);
          quickSwitcherIndexRef.current = startIdx;
          setQuickSwitcherIndex(startIdx);
        } else {
          // Cycle index
          const cur = quickSwitcherIndexRef.current;
          let nextIdx: number;
          if (isReverse) {
            nextIdx = (cur - 1 + ordered.length) % ordered.length;
          } else {
            nextIdx = (cur + 1) % ordered.length;
          }
          quickSwitcherIndexRef.current = nextIdx;
          setQuickSwitcherIndex(nextIdx);
        }
        return;
      }

      // 2. Escape cancels quick switcher overlay
      if (e.key === "Escape" && isQuickSwitcherOpenRef.current) {
        e.preventDefault();
        isQuickSwitcherOpenRef.current = false;
        setIsQuickSwitcherOpen(false);
        return;
      }

      // Other Standard Shortcuts
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

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isQuickSwitcherOpenRef.current) return;

      const shortcutConfig = settings.quick_switcher_shortcut || "ctrl_tab";
      const isModifierReleased =
        (shortcutConfig === "ctrl_tab" && (e.key === "Control" || e.key === "Meta")) ||
        (shortcutConfig === "alt_tab" && e.key === "Alt") ||
        (shortcutConfig === "ctrl_pagedown" && (e.key === "Control" || e.key === "Meta"));

      if (isModifierReleased) {
        isQuickSwitcherOpenRef.current = false;
        setIsQuickSwitcherOpen(false);

        const currentList = quickSwitcherNotesRef.current;
        const targetNote = currentList[quickSwitcherIndexRef.current];
        if (targetNote) {
          handleSelectNote(targetNote);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isAlwaysOnTop, notes, activeNote, settings, getOrderedNotes]);

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
          noteId={activeNote?.id || null}
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

      {/* Quick Switcher HUD / Overlay */}
      <QuickSwitcherOverlay
        isOpen={isQuickSwitcherOpen}
        notes={quickSwitcherNotesRef.current.length > 0 ? quickSwitcherNotesRef.current : notes}
        selectedIndex={quickSwitcherIndex}
        onSelectIndex={(idx) => {
          setQuickSwitcherIndex(idx);
          quickSwitcherIndexRef.current = idx;
          const targetNote = (quickSwitcherNotesRef.current.length > 0 ? quickSwitcherNotesRef.current : notes)[idx];
          if (targetNote) {
            handleSelectNote(targetNote);
          }
          setIsQuickSwitcherOpen(false);
          isQuickSwitcherOpenRef.current = false;
        }}
        onClose={() => {
          setIsQuickSwitcherOpen(false);
          isQuickSwitcherOpenRef.current = false;
        }}
      />

      {/* Note Switcher Modal */}
      <NoteSwitcher
        isOpen={isNoteSwitcherOpen}
        notes={notes}
        activeNoteId={activeNote?.id || null}
        onSelectNote={handleSelectNote}
        onTogglePin={handleTogglePinNote}
        onDeleteNote={handleDeleteNote}
        onRestoreNote={handleRestoreNote}
        onClose={() => setIsNoteSwitcherOpen(false)}
      />

      {/* Undo Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-12 right-6 z-50 animate-in slide-in-from-bottom-3 duration-150 flex items-center space-x-3 bg-[#1E2532] border border-[#2F3949] text-white px-4 py-2.5 rounded-xl shadow-2xl">
          <span className="text-xs text-gray-200">{toast.message}</span>
          {toast.undoNote && (
            <button
              onClick={handleUndoDelete}
              className="text-xs font-semibold text-[var(--accent-color,#0399F7)] hover:underline focus:outline-none"
            >
              Undo
            </button>
          )}
          <button
            onClick={() => setToast({ visible: false, message: "", undoNote: null })}
            className="text-gray-400 hover:text-white p-0.5 ml-1 focus:outline-none text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Command Actions Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        actions={actions}
        notes={notes}
        onSelectNote={handleSelectNote}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        notesDir={notesDir}
        notes={notes}
      />

      {/* First-Run Welcome Screen */}
      <WelcomeModal
        isOpen={isWelcomeOpen}
        onClose={() => setIsWelcomeOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Custom Frameless Installer Wizard (temporarily disabled) */}
      {/* {isInstallerOpen && (
        <CustomInstaller
          onClose={() => setIsInstallerOpen(false)}
          onInstalled={() => setIsInstallerOpen(false)}
        />
      )} */}
    </div>
  );
}

export default App;
