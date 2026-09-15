import React, { useState, useEffect, useRef, useCallback } from "react";
import { Titlebar } from "./components/Titlebar";
import { Editor, EditorHandle } from "./components/Editor";
import { BottomToolbar } from "./components/BottomToolbar";
import { NoteSwitcher } from "./components/NoteSwitcher";
import { QuickSwitcherOverlay } from "./components/QuickSwitcherOverlay";
import { CommandPalette, ActionItem } from "./components/CommandPalette";
import { SettingsView } from "./components/SettingsView";
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
  SaveIcon,
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

  const showToast = useCallback((message: string, undoNote: NoteMetadata | null = null) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ visible: true, message, undoNote });
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ visible: false, message: "", undoNote: null });
    }, 5000);
  }, []);

  // Save status & pending edits tracking
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const pendingSaveRef = useRef<{ filename: string; markdown: string; isPinned: boolean } | null>(null);
  const hasUnsavedChangesRef = useRef<boolean>(false);
  const activeNoteRef = useRef<NoteMetadata | null>(null);
  const notesRef = useRef<NoteMetadata[]>(notes);

  useEffect(() => {
    activeNoteRef.current = activeNote;
  }, [activeNote]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // Editor refs
  const editorRef = useRef<EditorHandle>(null);
  const [tiptapInstance, setTiptapInstance] = useState<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to detect abandoned blank notes (untitled, zero chars, no content, unpinned)
  const isAbandonedEmptyNote = (note: NoteMetadata | null | undefined): boolean => {
    if (!note) return false;
    return (
      note.character_count === 0 &&
      (!note.content || note.content.trim() === "") &&
      (!note.title || note.title === "Untitled" || note.title.trim() === "") &&
      !note.is_pinned
    );
  };

  // Immediate flush of pending debounced save
  const flushPendingSave = useCallback(async (): Promise<NoteMetadata | null> => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const current = activeNoteRef.current;
    if (hasUnsavedChangesRef.current && current) {
      const markdown = editorRef.current?.getMarkdown() ?? current.content ?? "";
      try {
        const saved = await api.saveNote(current.filename, markdown, current.is_pinned);
        pendingSaveRef.current = null;
        hasUnsavedChangesRef.current = false;
        setSaveStatus("saved");
        setActiveNote((prev) => (prev && prev.filename === saved.filename ? { ...prev, ...saved } : prev));
        setNotes((prevNotes) => {
          const index = prevNotes.findIndex((n) => n.id === saved.id);
          let updated = [...prevNotes];
          if (index !== -1) updated[index] = saved;
          else updated.unshift(saved);
          return updated.sort(
            (a, b) =>
              (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
              b.updated_at - a.updated_at
          );
        });
        return saved;
      } catch (err) {
        console.error("Failed to flush save:", err);
        setSaveStatus("error");
        showToast("Save failed: " + (typeof err === "string" ? err : "Could not write to disk"));
      }
    }
    return null;
  }, [showToast]);

  // Retry save when in error state
  const retrySave = useCallback(async () => {
    const current = activeNoteRef.current;
    if (!current) return;
    const markdown = editorRef.current?.getMarkdown() ?? current.content ?? "";
    setSaveStatus("saving");
    try {
      const saved = await api.saveNote(current.filename, markdown, current.is_pinned);
      pendingSaveRef.current = null;
      hasUnsavedChangesRef.current = false;
      setActiveNote((prev) => (prev ? { ...prev, ...saved } : saved));
      setNotes((prevNotes) => {
        const index = prevNotes.findIndex((n) => n.id === saved.id);
        let updated = [...prevNotes];
        if (index !== -1) updated[index] = saved;
        else updated.unshift(saved);
        return updated.sort(
          (a, b) =>
            (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
            b.updated_at - a.updated_at
        );
      });
      setSaveStatus("saved");
      showToast("Note saved successfully.");
    } catch (err) {
      console.error("Retry save failed:", err);
      setSaveStatus("error");
      showToast("Retry failed: " + (typeof err === "string" ? err : "Could not write to disk"));
    }
  }, [showToast]);

  // Save current note changes with debounce
  const handleEditorChange = useCallback(
    (charCount: number, firstLineTitle: string) => {
      setActiveTitle(firstLineTitle);
      setCharacterCount(charCount);
      hasUnsavedChangesRef.current = true;
      setSaveStatus("saving");

      const current = activeNoteRef.current;
      if (current) {
        pendingSaveRef.current = {
          filename: current.filename,
          markdown: "",
          isPinned: current.is_pinned,
        };
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        const target = activeNoteRef.current;
        if (!target) return;

        const markdown = editorRef.current?.getMarkdown() ?? target.content ?? "";
        try {
          const saved = await api.saveNote(
            target.filename,
            markdown,
            target.is_pinned
          );

          pendingSaveRef.current = null;
          hasUnsavedChangesRef.current = false;
          setSaveStatus("saved");

          setActiveNote((prev) => (prev && prev.filename === saved.filename ? { ...prev, ...saved } : prev));

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
          setSaveStatus("error");
          showToast("Failed to save note. Check disk write permissions.");
        }
      }, settings.auto_save_interval || 400);
    },
    [settings.auto_save_interval, showToast]
  );

  // New Note
  const handleNewNote = useCallback(async () => {
    // If currently on an untyped blank note, simply keep focus instead of accumulating empty notes
    if (isAbandonedEmptyNote(activeNoteRef.current)) {
      editorRef.current?.focus();
      return;
    }

    await flushPendingSave();

    try {
      const newNote = await api.saveNote("", "", false);
      setNotes((prev) => [newNote, ...prev]);
      setActiveNote(newNote);
      setActiveTitle("Untitled");
      setCharacterCount(0);
      setSaveStatus("saved");
      hasUnsavedChangesRef.current = false;
      pendingSaveRef.current = null;

      // Track last active note in settings
      const updated = { ...settings, last_active_note_id: newNote.id };
      setSettings(updated);
      api.saveSettings(updated);

      setTimeout(() => editorRef.current?.focus(), 50);
    } catch (e) {
      console.error("Failed to create new note:", e);
      showToast("Failed to create new note");
    }
  }, [flushPendingSave, settings, showToast]);

  // Select Note
  const handleSelectNote = useCallback(async (note: NoteMetadata) => {
    if (activeNoteRef.current?.id === note.id) return;

    // Flush any pending save on the current note before switching
    await flushPendingSave();

    // Clean up previous note if it was an abandoned empty note
    const prev = activeNoteRef.current;
    if (isAbandonedEmptyNote(prev) && prev?.filename !== note.filename) {
      try {
        await api.deleteNote(prev!.filename);
        setNotes((prevNotes) => prevNotes.filter((n) => n.filename !== prev!.filename));
      } catch (err) {
        console.warn("Could not prune abandoned empty note:", err);
      }
    }

    setActiveNote(note);
    setActiveTitle(note.title);
    setCharacterCount(note.character_count);
    setSaveStatus("saved");
    hasUnsavedChangesRef.current = false;
    pendingSaveRef.current = null;

    // Update MRU list
    setRecentNoteIds((prevIds) => [note.id, ...prevIds.filter((id) => id !== note.id)]);

    // Track last active note in settings
    const updated = { ...settings, last_active_note_id: note.id };
    setSettings(updated);
    api.saveSettings(updated);

    setTimeout(() => editorRef.current?.focus(), 50);
  }, [flushPendingSave, settings]);

  // Toggle Pin Note (persisted in metadata index, no destructive filename mutations)
  const handleTogglePinNote = useCallback(async (note: NoteMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinned = !note.is_pinned;
    try {
      await api.setNotePinned(note.filename, newPinned);

      setNotes((prevNotes) => {
        const updated = prevNotes.map((n) =>
          n.filename === note.filename ? { ...n, is_pinned: newPinned } : n
        );
        return updated.sort(
          (a, b) =>
            (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
            b.updated_at - a.updated_at
        );
      });

      if (activeNoteRef.current?.filename === note.filename) {
        setActiveNote((prev) => (prev ? { ...prev, is_pinned: newPinned } : null));
      }
    } catch (err) {
      console.error("Failed to toggle note pin:", err);
      showToast(typeof err === "string" ? err : "Failed to toggle pin");
    }
  }, [showToast]);

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

          if (!targetNote) {
            targetNote = loadedNotes[0];
          }

          setActiveNote(targetNote);
          setActiveTitle(targetNote.title);
          setCharacterCount(targetNote.character_count);
        } else {
          await handleNewNote();
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    init();
  }, [handleNewNote]);

  // External file synchronization (on focus and periodic)
  useEffect(() => {
    const syncExternalChanges = async () => {
      try {
        const diskNotes = await api.listNotes();
        const currentActive = activeNoteRef.current;

        if (currentActive) {
          const found = diskNotes.find((n) => n.filename === currentActive.filename);
          if (!found) {
            if (!hasUnsavedChangesRef.current) {
              showToast("Active note was deleted externally.");
              setNotes(diskNotes);
              if (diskNotes.length > 0) {
                handleSelectNote(diskNotes[0]);
              } else {
                handleNewNote();
              }
              return;
            } else {
              showToast("Active note was removed on disk, but your local edits are kept.");
            }
          } else if (found.updated_at > currentActive.updated_at + 1500) {
            // File was modified externally
            if (!hasUnsavedChangesRef.current && saveStatus !== "saving") {
              const fullNote = await api.readNote(currentActive.filename);
              setActiveNote(fullNote);
              setActiveTitle(fullNote.title);
              setCharacterCount(fullNote.character_count);
              editorRef.current?.setMarkdown(fullNote.content);
              showToast("Reloaded note from external changes.");
            } else {
              showToast("External changes detected on disk. Press Ctrl+S to save your version.");
            }
          }
        }

        setNotes((prevNotes) => {
          if (prevNotes.length !== diskNotes.length) return diskNotes;
          const map = new Map(prevNotes.map((n) => [n.filename, n.updated_at]));
          const hasDiff = diskNotes.some((n) => map.get(n.filename) !== n.updated_at);
          return hasDiff ? diskNotes : prevNotes;
        });
      } catch (err) {
        console.error("External sync error:", err);
      }
    };

    const handleFocus = () => {
      syncExternalChanges();
    };

    window.addEventListener("focus", handleFocus);
    const interval = setInterval(syncExternalChanges, 10000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [handleNewNote, handleSelectNote, saveStatus, showToast]);

  // Beforeunload handler to flush saves and persist window state
  useEffect(() => {
    const handleBeforeUnload = () => {
      const current = activeNoteRef.current;
      if (hasUnsavedChangesRef.current && current) {
        const markdown = editorRef.current?.getMarkdown() ?? current.content ?? "";
        api.saveNote(current.filename, markdown, current.is_pinned).catch(() => {});
      }
      api.saveWindowState().catch(() => {});
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Delete Note (move to trash)
  const handleDeleteNote = async (note: NoteMetadata, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (pendingSaveRef.current?.filename === note.filename) {
        pendingSaveRef.current = null;
      }
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

      // 2. Escape cancels quick switcher overlay or closes Settings
      if (e.key === "Escape") {
        if (isQuickSwitcherOpenRef.current) {
          e.preventDefault();
          isQuickSwitcherOpenRef.current = false;
          setIsQuickSwitcherOpen(false);
          return;
        }
        if (isSettingsOpen) {
          e.preventDefault();
          setIsSettingsOpen(false);
          return;
        }
      }

      // Other Standard Shortcuts
      if (isCmdOrCtrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setIsSettingsOpen(false);
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
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flushPendingSave();
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
      id: "save_note",
      title: "Save Note Now",
      shortcut: ["Ctrl", "S"],
      icon: <SaveIcon size={16} />,
      perform: () => flushPendingSave(),
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
        isSettingsOpen={isSettingsOpen}
        onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenNoteSwitcher={() => setIsNoteSwitcherOpen(true)}
        onNewNote={handleNewNote}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCloseSettings={() => setIsSettingsOpen(false)}
        onMinimize={() => api.minimizeWindow()}
        onClose={() => api.closeWindow()}
      />

      {/* Main View Area: Either SettingsView or Editor + Toolbar */}
      {isSettingsOpen ? (
        <SettingsView
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          notesDir={notesDir}
          notes={notes}
          onClose={() => setIsSettingsOpen(false)}
          onRestoreNote={handleRestoreNote}
        />
      ) : (
        <>
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
            saveStatus={saveStatus}
            onRetrySave={retrySave}
          />
        </>
      )}

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
