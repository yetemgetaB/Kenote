import React, { useState, useEffect, useRef } from "react";
import { NoteMetadata } from "../types/note";
import { PinIcon, TrashIcon, RestoreIcon } from "./Icons";
import { api } from "../utils/tauriBridge";

interface NoteSwitcherProps {
  isOpen: boolean;
  notes: NoteMetadata[];
  activeNoteId: string | null;
  onSelectNote: (note: NoteMetadata) => void;
  onTogglePin: (note: NoteMetadata, e: React.MouseEvent) => void;
  onDeleteNote: (note: NoteMetadata, e: React.MouseEvent) => void;
  onRestoreNote?: (note: NoteMetadata) => void;
  onClose: () => void;
}

export const NoteSwitcher: React.FC<NoteSwitcherProps> = ({
  isOpen,
  notes,
  activeNoteId,
  onSelectNote,
  onTogglePin,
  onDeleteNote,
  onRestoreNote,
  onClose,
}) => {
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [trashedNotes, setTrashedNotes] = useState<NoteMetadata[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load trashed notes whenever modal opens or tab changes to trash
  const loadTrashedNotes = async () => {
    try {
      const trashed = await api.listTrashedNotes();
      setTrashedNotes(trashed);
    } catch (e) {
      console.error("Failed to load trashed notes:", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTab("active");
      loadTrashedNotes();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && tab === "trash") {
      loadTrashedNotes();
    }
  }, [tab, isOpen]);

  // Current active list based on tab
  const currentList = tab === "active" ? notes : trashedNotes;

  // Filter notes
  const filteredNotes = currentList.filter((n) => {
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [search, tab]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredNotes.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + (filteredNotes.length || 1)) % (filteredNotes.length || 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredNotes[selectedIndex]) {
          if (tab === "active") {
            onSelectNote(filteredNotes[selectedIndex]);
            onClose();
          } else {
            handleRestore(filteredNotes[selectedIndex]);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredNotes, selectedIndex, onSelectNote, onClose, tab]);

  if (!isOpen) return null;

  const handleRestore = async (note: NoteMetadata) => {
    try {
      const restored = await api.restoreNote(note.filename);
      setTrashedNotes((prev) => prev.filter((n) => n.filename !== note.filename));
      if (onRestoreNote) {
        onRestoreNote(restored);
      }
    } catch (err) {
      console.error("Failed to restore note:", err);
    }
  };

  const handlePermanentDelete = async (note: NoteMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.permanentlyDeleteNote(note.filename);
      setTrashedNotes((prev) => prev.filter((n) => n.filename !== note.filename));
    } catch (err) {
      console.error("Failed to permanently delete note:", err);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await api.emptyTrash();
      setTrashedNotes([]);
    } catch (err) {
      console.error("Failed to empty trash:", err);
    }
  };

  const formatTimestamp = (ts: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - ts;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(ts * 1000).toLocaleDateString();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-[#1E242E] border border-[#2F3746] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[480px] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="p-3 border-b border-[#2A3240] flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "active" ? "Search for notes..." : "Search trash..."}
            className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none px-2 py-1"
          />
        </div>

        {/* Tab & Counter Header */}
        <div className="px-3 py-1.5 border-b border-[#262E3B] flex items-center justify-between text-xs text-gray-400 font-medium bg-[#171C24]">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setTab("active")}
              className={`px-2.5 py-1 rounded-lg transition-colors focus:outline-none ${
                tab === "active"
                  ? "bg-[#283242] text-white font-semibold"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Notes ({notes.length})
            </button>
            <button
              onClick={() => setTab("trash")}
              className={`px-2.5 py-1 rounded-lg transition-colors focus:outline-none flex items-center space-x-1 ${
                tab === "trash"
                  ? "bg-[#283242] text-white font-semibold"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <TrashIcon size={12} />
              <span>Trash ({trashedNotes.length})</span>
            </button>
          </div>

          {tab === "trash" && trashedNotes.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="text-[11px] text-red-400 hover:text-red-300 transition-colors focus:outline-none px-2 py-0.5"
            >
              Empty Trash
            </button>
          )}
        </div>

        {/* Notes List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1"
        >
          {filteredNotes.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500">
              {tab === "active" ? "No notes found" : "Trash is empty"}
            </div>
          ) : (
            filteredNotes.map((note, index) => {
              const isSelected = index === selectedIndex;
              const isCurrent = note.id === activeNoteId && tab === "active";

              return (
                <div
                  key={note.id}
                  onClick={() => {
                    if (tab === "active") {
                      onSelectNote(note);
                      onClose();
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-3 py-2.5 rounded-xl flex items-center justify-between group transition-all ${
                    tab === "active" ? "cursor-pointer" : "cursor-default"
                  } ${
                    isSelected
                      ? "bg-[#283242] text-white shadow-sm"
                      : "text-gray-300 hover:bg-[#242C3A]"
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center space-x-1.5">
                      {note.is_pinned && tab === "active" && (
                        <PinIcon size={12} filled className="text-[var(--accent-color,#0399F7)] shrink-0" />
                      )}
                      <span className="text-sm font-semibold truncate block">
                        {note.title || "Untitled"}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center space-x-1.5">
                      {isCurrent ? (
                        <>
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-color,#0399F7)]"></span>
                          <span className="text-[var(--accent-color,#0399F7)] font-medium">Current</span>
                        </>
                      ) : (
                        <span>{formatTimestamp(note.updated_at)}</span>
                      )}
                      <span>•</span>
                      <span>{note.character_count} characters</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100">
                    {tab === "active" ? (
                      <>
                        <button
                          onClick={(e) => onTogglePin(note, e)}
                          title={note.is_pinned ? "Unpin Note" : "Pin Note to Top"}
                          className={`p-1.5 rounded hover:bg-[#323E52] transition-colors focus:outline-none ${
                            note.is_pinned ? "text-[var(--accent-color,#0399F7)]" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          <PinIcon size={13} filled={note.is_pinned} />
                        </button>
                        <button
                          onClick={(e) => onDeleteNote(note, e)}
                          title="Move to Trash"
                          className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-colors focus:outline-none"
                        >
                          <TrashIcon size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestore(note)}
                          title="Restore Note"
                          className="px-2 py-1 rounded bg-[#252C38] hover:bg-[#303948] text-green-400 hover:text-green-300 flex items-center space-x-1 text-xs transition-colors focus:outline-none"
                        >
                          <RestoreIcon size={12} />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={(e) => handlePermanentDelete(note, e)}
                          title="Delete Forever"
                          className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-colors focus:outline-none"
                        >
                          <TrashIcon size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
