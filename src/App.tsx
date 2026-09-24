import React, { useState, useEffect, useRef, useCallback } from "react";
import { Titlebar } from "./components/Titlebar";
import { Editor, EditorHandle } from "./components/Editor";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { BottomToolbar } from "./components/BottomToolbar";
import { NoteSwitcher } from "./components/NoteSwitcher";
import { QuickSwitcherOverlay } from "./components/QuickSwitcherOverlay";
import { CommandPalette, ActionItem } from "./components/CommandPalette";
import { SettingsView } from "./components/SettingsView";
import { WelcomeModal } from "./components/WelcomeModal";
import { UpdateModal } from "./components/UpdateModal";
import { NoteMetadata, AppSettings, DEFAULT_SETTINGS } from "./types/note";
import { api, isValidExternalUrl } from "./utils/tauriBridge";
import { applyAccentColor } from "./utils/theme";
import {
  incrementGlobalZoom,
  decrementGlobalZoom,
  incrementEditorZoom,
  decrementEditorZoom,
  applyGlobalZoom,
  DEFAULT_GLOBAL_ZOOM,
  DEFAULT_EDITOR_ZOOM,
} from "./utils/zoom";
import {
  setTelemetryEnabled,
  trackAppLaunch,
  trackNoteCreated,
  trackNoteDeleted,
  trackNoteRestored,
  trackUpdateCheck,
  trackUpdateAvailable,
} from "./utils/analytics";
import {
  checkForUpdate,
  UpdateInfo,
  checkPendingUpdateSuccess,
  isStartupUpdateEligible,
  markStartupUpdateCheckedThisSession,
} from "./utils/updater";
import { APP_VERSION } from "./utils/version";
import {
  PlusIcon,
  NoteSwitcherIcon,
  PinIcon,
  CopyIcon,
  FolderIcon,
  SettingsIcon,
  TrashIcon,
  SaveIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./components/Icons";

export function App() {
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [activeNote, setActiveNote] = useState<NoteMetadata | null>(null);
  const [activeTitle, setActiveTitle] = useState("Untitled");
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [notesDir, setNotesDir] = useState("");

  // MRU Note history
  const [, setRecentNoteIds] = useState<string[]>([]);
  const recentNoteIdsRef = useRef<string[]>([]);

  // Settings ref to prevent stale closures in event listeners
  const settingsRef = useRef<AppSettings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Modals state
  const [isNoteSwitcherOpen, setIsNoteSwitcherOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(null);

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

  // Intercept all external link clicks to reliably open in user's default browser
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const anchor = target?.closest("a");
      if (anchor) {
        const href = anchor.getAttribute("href") || "";
        if (href.startsWith("#")) return;
        if (isValidExternalUrl(href)) {
          event.preventDefault();
          event.stopPropagation();
          api.openExternal(href);
        }
      }
    };

    document.addEventListener("click", handleGlobalClick, true);
    return () => {
      document.removeEventListener("click", handleGlobalClick, true);
    };
  }, []);

  // Editor refs
  const editorRef = useRef<EditorHandle>(null);
  const [tiptapInstance, setTiptapInstance] = useState<TiptapEditor | null>(null);
  const handleEditorReady = useCallback((instance: TiptapEditor) => {
    setTiptapInstance(instance);
  }, []);
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
    (newCharCount: number, newWordCount: number, firstLineTitle: string) => {
      setActiveTitle(firstLineTitle);
      setCharCount(newCharCount);
      setWordCount(newWordCount);
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

    editorRef.current?.flushCursor();
    await flushPendingSave();

    try {
      const newNote = await api.saveNote("", "", false);
      trackNoteCreated();
      notesRef.current = [newNote, ...notesRef.current];
      activeNoteRef.current = newNote;
      recentNoteIdsRef.current = [newNote.id, ...recentNoteIdsRef.current.filter((id) => id !== newNote.id)];

      setNotes(notesRef.current);
      setActiveNote(newNote);
      setActiveTitle("Untitled");
      setCharCount(0);
      setWordCount(0);
      setSaveStatus("saved");
      hasUnsavedChangesRef.current = false;
      pendingSaveRef.current = null;
      setRecentNoteIds(recentNoteIdsRef.current);

      // Track last active note in settings
      setSettings((prev) => {
        const updated = { ...prev, last_active_note_id: newNote.id };
        settingsRef.current = updated;
        api.saveSettings(updated);
        return updated;
      });

      setTimeout(() => editorRef.current?.focus(), 50);
    } catch (e) {
      console.error("Failed to create new note:", e);
      showToast("Failed to create new note");
    }
  }, [flushPendingSave, showToast]);

  // Select Note
  const handleSelectNote = useCallback((note: NoteMetadata) => {
    if (activeNoteRef.current?.id === note.id) return;

    // Flush cursor on previous note
    editorRef.current?.flushCursor();

    const prev = activeNoteRef.current;

    // Update active note ref and MRU IMMEDIATELY to prevent race conditions on rapid switching
    activeNoteRef.current = note;
    recentNoteIdsRef.current = [note.id, ...recentNoteIdsRef.current.filter((id) => id !== note.id)];
    setActiveNote(note);
    setActiveTitle(note.title);
    setCharCount(note.character_count);
    setRecentNoteIds(recentNoteIdsRef.current);

    // Track last active note in settings
    setSettings((prevSettings) => {
      const updated = { ...prevSettings, last_active_note_id: note.id };
      settingsRef.current = updated;
      api.saveSettings(updated);
      return updated;
    });

    // Flush any pending save on the previous note in background
    if (hasUnsavedChangesRef.current && prev) {
      const markdown = editorRef.current?.getMarkdown() ?? prev.content ?? "";
      api.saveNote(prev.filename, markdown, prev.is_pinned).then((saved) => {
        notesRef.current = notesRef.current.map((n) => (n.id === saved.id ? saved : n)).sort(
          (a, b) =>
            (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
            b.updated_at - a.updated_at
        );
        setNotes(notesRef.current);
      }).catch((err) => {
        console.error("Failed to save previous note on switch:", err);
      });
      hasUnsavedChangesRef.current = false;
      pendingSaveRef.current = null;
      setSaveStatus("saved");
    }

    // Clean up previous note if it was an abandoned empty note
    if (isAbandonedEmptyNote(prev) && prev?.filename !== note.filename) {
      api.deleteNote(prev!.filename).then(() => {
        notesRef.current = notesRef.current.filter((n) => n.filename !== prev!.filename);
        recentNoteIdsRef.current = recentNoteIdsRef.current.filter((id) => id !== prev!.id);
        setNotes(notesRef.current);
        setRecentNoteIds(recentNoteIdsRef.current);
      }).catch((err) => {
        console.warn("Could not prune abandoned empty note:", err);
      });
    }

    setTimeout(() => editorRef.current?.focus(), 50);
  }, []);

  // Toggle Pin Note (persisted in metadata index, no destructive filename mutations)
  const handleTogglePinNote = useCallback(async (note: NoteMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinned = !note.is_pinned;
    try {
      // Synchronously update activeNoteRef, pendingSaveRef, and notesRef before async IPC to protect against autosave races
      if (activeNoteRef.current?.filename === note.filename) {
        activeNoteRef.current = { ...activeNoteRef.current, is_pinned: newPinned };
        if (pendingSaveRef.current && pendingSaveRef.current.filename === note.filename) {
          pendingSaveRef.current.isPinned = newPinned;
        }
      }

      notesRef.current = notesRef.current
        .map((n) => (n.filename === note.filename ? { ...n, is_pinned: newPinned } : n))
        .sort(
          (a, b) =>
            (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
            b.updated_at - a.updated_at
        );

      await api.setNotePinned(note.filename, newPinned);

      setNotes(notesRef.current);
      if (activeNoteRef.current?.filename === note.filename) {
        setActiveNote(activeNoteRef.current);
      }
    } catch (err) {
      console.error("Failed to toggle note pin:", err);
      showToast(typeof err === "string" ? err : "Failed to toggle pin");
    }
  }, [showToast]);

  const hasInitializedRef = useRef(false);
  const handleNewNoteRef = useRef(handleNewNote);
  useEffect(() => {
    handleNewNoteRef.current = handleNewNote;
  }, [handleNewNote]);

  // Load initial data (strictly once on startup)
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    async function init() {
      try {
        const loadedSettings = await api.getSettings();
        setSettings(loadedSettings);
        settingsRef.current = loadedSettings;
        setIsAlwaysOnTop(loadedSettings.always_on_top);
        applyAccentColor(loadedSettings.accent_color);
        applyGlobalZoom(loadedSettings.global_zoom ?? DEFAULT_GLOBAL_ZOOM);

        const telemetryEnabled = loadedSettings.telemetry_enabled ?? true;
        setTelemetryEnabled(telemetryEnabled);
        if (telemetryEnabled) {
          trackAppLaunch();
        }

        if (!loadedSettings.has_completed_onboarding) {
          setIsWelcomeOpen(true);
        }

        const dir = await api.getNotesDirectory();
        setNotesDir(dir);

        const loadedNotes = await api.listNotes();
        notesRef.current = loadedNotes;
        setNotes(loadedNotes);

        const startupMode = loadedSettings.startup_behavior || "last";

        if (loadedNotes.length > 0) {
          let targetNote: NoteMetadata | undefined;

          if (startupMode === "new") {
            await handleNewNoteRef.current();
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

          activeNoteRef.current = targetNote;
          setActiveNote(targetNote);
          setActiveTitle(targetNote.title);
          setCharCount(targetNote.character_count);

          // Seed MRU deterministically: active note first, followed by remaining notes sorted by recency (updated_at desc)
          const sortedByRecency = loadedNotes
            .slice()
            .sort((a, b) => b.updated_at - a.updated_at);
          const initialMru = [
            targetNote.id,
            ...sortedByRecency.filter((n) => n.id !== targetNote!.id).map((n) => n.id),
          ];
          recentNoteIdsRef.current = initialMru;
          setRecentNoteIds(initialMru);
        } else {
          await handleNewNoteRef.current();
        }
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    init();
  }, []);

  // Post-update confirmation check on application startup
  useEffect(() => {
    try {
      const updateResult = checkPendingUpdateSuccess(APP_VERSION);
      if (updateResult.isSuccess) {
        showToast(`KeNote was updated successfully. You're now running v${APP_VERSION}.`);
      }
    } catch (err) {
      console.warn("Failed to check pending update status:", err);
    }
  }, [showToast]);

  // Silent background update check on app launch
  useEffect(() => {
    if (!isStartupUpdateEligible()) {
      return;
    }
    markStartupUpdateCheckedThisSession();

    const timer = setTimeout(async () => {
      try {
        trackUpdateCheck("automatic");
        const res = await checkForUpdate();
        if (res.available && res.update && isStartupUpdateEligible()) {
          trackUpdateAvailable(res.update.version, "automatic");
          setAvailableUpdate(res.update);
          setIsUpdateModalOpen(true);
        }
      } catch (err) {
        // Silently swallow background update check errors (offline, firewall, etc.)
        console.warn("Silent update check failed:", err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

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
              notesRef.current = diskNotes;
              setNotes(diskNotes);
              recentNoteIdsRef.current = recentNoteIdsRef.current.filter((id) =>
                diskNotes.some((n) => n.id === id)
              );
              setRecentNoteIds(recentNoteIdsRef.current);

              if (diskNotes.length > 0) {
                handleSelectNote(diskNotes[0]);
              } else {
                handleNewNote();
              }
              return;
            } else {
              showToast("Active note was removed on disk, but your local edits are kept.");
            }
          } else {
            // Keep pin status synchronized if changed on disk
            if (found.is_pinned !== currentActive.is_pinned) {
              activeNoteRef.current = { ...currentActive, is_pinned: found.is_pinned };
              setActiveNote((prev) => (prev ? { ...prev, is_pinned: found.is_pinned } : prev));
            }

            if (found.updated_at > currentActive.updated_at + 1500) {
              // File was modified externally
              if (!hasUnsavedChangesRef.current && saveStatus !== "saving") {
                const fullNote = await api.readNote(currentActive.filename);
                activeNoteRef.current = fullNote;
                setActiveNote(fullNote);
                setActiveTitle(fullNote.title);
                setCharCount(fullNote.character_count);
                editorRef.current?.setMarkdown(fullNote.content);
                showToast("Reloaded note from external changes.");
              } else {
                showToast("External changes detected on disk. Press Ctrl+S to save your version.");
              }
            }
          }
        }

        // Clean up any stale IDs from recentNoteIdsRef that no longer exist on disk
        const diskIdSet = new Set(diskNotes.map((n) => n.id));
        const prunedMru = recentNoteIdsRef.current.filter((id) => diskIdSet.has(id));
        if (prunedMru.length !== recentNoteIdsRef.current.length) {
          recentNoteIdsRef.current = prunedMru;
          setRecentNoteIds(prunedMru);
        }

        notesRef.current = diskNotes;
        setNotes((prevNotes) => {
          if (prevNotes.length !== diskNotes.length) return diskNotes;
          const map = new Map(prevNotes.map((n) => [n.filename, n.updated_at]));
          const hasDiff = diskNotes.some((n) => map.get(n.filename) !== n.updated_at || map.has(n.filename) === false);
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

  // Beforeunload handler to flush saves, cursor, and persist window state
  useEffect(() => {
    const handleBeforeUnload = () => {
      editorRef.current?.flushCursor();
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
      trackNoteDeleted();
      const remaining = notesRef.current.filter((n) => n.filename !== note.filename);
      notesRef.current = remaining;
      recentNoteIdsRef.current = recentNoteIdsRef.current.filter((id) => id !== note.id);
      setNotes(remaining);
      setRecentNoteIds(recentNoteIdsRef.current);

      try {
        const key = "kenote_cursor_positions";
        const currentMap = JSON.parse(localStorage.getItem(key) || "{}");
        delete currentMap[note.id];
        localStorage.setItem(key, JSON.stringify(currentMap));
      } catch {}

      if (activeNoteRef.current?.filename === note.filename) {
        if (remaining.length > 0) {
          const nextMruId = recentNoteIdsRef.current[0];
          const nextNote = remaining.find((n) => n.id === nextMruId) || remaining[0];
          handleSelectNote(nextNote);
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
    trackNoteRestored();
    notesRef.current = [restoredNote, ...notesRef.current.filter((n) => n.id !== restoredNote.id)].sort(
      (a, b) =>
        (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) ||
        b.updated_at - a.updated_at
    );
    setNotes(notesRef.current);
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
    settingsRef.current = updated;
    setSettings(updated);
    await api.saveSettings(updated);
  };

  // Update Settings
  const handleUpdateSettings = async (newSettings: AppSettings) => {
    const prevCustomDir = settingsRef.current.custom_notes_dir;
    settingsRef.current = newSettings;
    setSettings(newSettings);
    applyAccentColor(newSettings.accent_color);
    applyGlobalZoom(newSettings.global_zoom ?? DEFAULT_GLOBAL_ZOOM);

    // If custom_notes_dir changed, refresh notes directory and load notes from new directory
    if (newSettings.custom_notes_dir !== prevCustomDir) {
      try {
        const newDir = await api.getNotesDirectory();
        setNotesDir(newDir);
        const reloadedNotes = await api.listNotes();
        notesRef.current = reloadedNotes;
        setNotes(reloadedNotes);

        if (reloadedNotes.length > 0) {
          const stillExists = activeNoteRef.current && reloadedNotes.some((n) => n.id === activeNoteRef.current?.id);
          if (!stillExists) {
            const first = reloadedNotes[0];
            activeNoteRef.current = first;
            setActiveNote(first);
            setActiveTitle(first.title);
            setCharCount(first.character_count);

            const sorted = reloadedNotes.slice().sort((a, b) => b.updated_at - a.updated_at);
            const mru = [first.id, ...sorted.filter((n) => n.id !== first.id).map((n) => n.id)];
            recentNoteIdsRef.current = mru;
            setRecentNoteIds(mru);
          }
        } else {
          activeNoteRef.current = null;
          setActiveNote(null);
          setActiveTitle("Untitled");
          setCharCount(0);
          setWordCount(0);
          recentNoteIdsRef.current = [];
          setRecentNoteIds([]);
        }
      } catch (err) {
        console.error("Failed to reload notes after directory switch:", err);
      }
    }
  };

  // Prepare ordered notes for Quick Switcher (MRU or Default list order)
  const getOrderedNotes = useCallback(() => {
    const currentNotes = notesRef.current;
    if (settingsRef.current.quick_switcher_order === "pinned_updated") {
      return currentNotes;
    }
    // MRU Order
    const mruNotes: NoteMetadata[] = [];
    const notesMap = new Map(currentNotes.map((n) => [n.id, n]));

    for (const id of recentNoteIdsRef.current) {
      const note = notesMap.get(id);
      if (note) {
        mruNotes.push(note);
        notesMap.delete(id);
      }
    }
    // Add any remaining unvisited notes sorted by recency (updated_at descending), NOT pinned priority!
    const unvisited = Array.from(notesMap.values()).sort((a, b) => b.updated_at - a.updated_at);
    for (const remaining of unvisited) {
      mruNotes.push(remaining);
    }
    return mruNotes;
  }, []);

  // Global Zoom Handlers
  const handleGlobalZoomIn = useCallback(() => {
    const cur = settingsRef.current.global_zoom ?? DEFAULT_GLOBAL_ZOOM;
    const next = incrementGlobalZoom(cur);
    applyGlobalZoom(next);
    const updated = { ...settingsRef.current, global_zoom: next };
    settingsRef.current = updated;
    setSettings(updated);
    api.saveSettings(updated);
  }, []);

  const handleGlobalZoomOut = useCallback(() => {
    const cur = settingsRef.current.global_zoom ?? DEFAULT_GLOBAL_ZOOM;
    const next = decrementGlobalZoom(cur);
    applyGlobalZoom(next);
    const updated = { ...settingsRef.current, global_zoom: next };
    settingsRef.current = updated;
    setSettings(updated);
    api.saveSettings(updated);
  }, []);

  const handleGlobalZoomReset = useCallback(() => {
    applyGlobalZoom(DEFAULT_GLOBAL_ZOOM);
    const updated = { ...settingsRef.current, global_zoom: DEFAULT_GLOBAL_ZOOM };
    settingsRef.current = updated;
    setSettings(updated);
    api.saveSettings(updated);
  }, []);

  // Editor Zoom Handlers
  const handleEditorZoomIn = useCallback(() => {
    const cur = settingsRef.current.editor_zoom ?? DEFAULT_EDITOR_ZOOM;
    const next = incrementEditorZoom(cur);
    const updated = { ...settingsRef.current, editor_zoom: next };
    settingsRef.current = updated;
    setSettings(updated);
    api.saveSettings(updated);
  }, []);

  const handleEditorZoomOut = useCallback(() => {
    const cur = settingsRef.current.editor_zoom ?? DEFAULT_EDITOR_ZOOM;
    const next = decrementEditorZoom(cur);
    const updated = { ...settingsRef.current, editor_zoom: next };
    settingsRef.current = updated;
    setSettings(updated);
    api.saveSettings(updated);
  }, []);

  const handleEditorZoomReset = useCallback(() => {
    const updated = { ...settingsRef.current, editor_zoom: DEFAULT_EDITOR_ZOOM };
    settingsRef.current = updated;
    setSettings(updated);
    api.saveSettings(updated);
  }, []);

  // Global Keyboard Shortcuts & Quick Switcher modifier release
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const shortcutConfig = settingsRef.current.quick_switcher_shortcut || "ctrl_tab";
      const switcherMode = settingsRef.current.quick_switcher_mode || "overlay";

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

      if (isSwitcherShortcut && notesRef.current.length > 1) {
        e.preventDefault();

        const ordered = getOrderedNotes();
        quickSwitcherNotesRef.current = ordered;

        if (switcherMode === "instant") {
          const currentId = activeNoteRef.current?.id;
          const currentIndex = ordered.findIndex((n) => n.id === currentId);
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

      // 3. Global Zoom Keyboard Shortcuts (Ctrl +, Ctrl -, Ctrl 0)
      if (isCmdOrCtrl && (e.key === "=" || e.key === "+" || e.code === "NumpadAdd")) {
        e.preventDefault();
        handleGlobalZoomIn();
      } else if (isCmdOrCtrl && (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract")) {
        e.preventDefault();
        handleGlobalZoomOut();
      } else if (isCmdOrCtrl && (e.key === "0" || e.code === "Numpad0")) {
        e.preventDefault();
        handleGlobalZoomReset();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "n") {
        // Other Standard Shortcuts
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

      const shortcutConfig = settingsRef.current.quick_switcher_shortcut || "ctrl_tab";
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
  }, [handleNewNote, handleSelectNote, flushPendingSave, handleToggleAlwaysOnTop, getOrderedNotes, isSettingsOpen]);

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
      id: "zoom_in",
      title: "Zoom In",
      shortcut: ["Ctrl", "+"],
      icon: <ZoomInIcon size={16} />,
      perform: () => handleGlobalZoomIn(),
    },
    {
      id: "zoom_out",
      title: "Zoom Out",
      shortcut: ["Ctrl", "-"],
      icon: <ZoomOutIcon size={16} />,
      perform: () => handleGlobalZoomOut(),
    },
    {
      id: "reset_zoom",
      title: "Reset Zoom",
      shortcut: ["Ctrl", "0"],
      icon: <ZoomInIcon size={16} />,
      perform: () => handleGlobalZoomReset(),
    },
    {
      id: "editor_zoom_in",
      title: "Editor Zoom In",
      icon: <ZoomInIcon size={16} />,
      perform: () => handleEditorZoomIn(),
    },
    {
      id: "editor_zoom_out",
      title: "Editor Zoom Out",
      icon: <ZoomOutIcon size={16} />,
      perform: () => handleEditorZoomOut(),
    },
    {
      id: "reset_editor_zoom",
      title: "Reset Editor Zoom",
      icon: <ZoomInIcon size={16} />,
      perform: () => handleEditorZoomReset(),
    },
    {
      id: "delete_active_note",
      title: "Delete Current Note",
      icon: <TrashIcon size={16} className="text-red-400" />,
      perform: () => {
        if (activeNote) {
          handleDeleteNote(activeNote);
        }
      },
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#16191E] text-[#E2E8F0] select-none overflow-hidden font-sans border border-[#262D38]/80 rounded-none shadow-2xl">
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
              editorZoom={settings.editor_zoom ?? DEFAULT_EDITOR_ZOOM}
              onEditorReady={handleEditorReady}
            />
          </main>

          {/* Bottom Formatting Toolbar */}
          <BottomToolbar
            editor={tiptapInstance}
            charCount={charCount}
            wordCount={wordCount}
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

      {/* Automatic Update Prompt */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        update={availableUpdate}
        onClose={() => setIsUpdateModalOpen(false)}
      />

    </div>
  );
}

export default App;
