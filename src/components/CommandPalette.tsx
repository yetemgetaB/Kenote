import React, { useState, useEffect, useRef } from "react";
import { NoteMetadata } from "../types/note";
import { PinIcon, NoteSwitcherIcon } from "./Icons";

export interface ActionItem {
  id: string;
  title: string;
  subtitle?: string;
  shortcut?: string[];
  icon: React.ReactNode;
  perform: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: ActionItem[];
  notes?: NoteMetadata[];
  onSelectNote?: (note: NoteMetadata) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  actions,
  notes = [],
  onSelectNote,
}) => {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter notes that match search query
  const filteredNotes = search.trim()
    ? notes.filter(
        (note) =>
          note.title.toLowerCase().includes(search.toLowerCase()) ||
          note.content.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  // Filter actions that match search query
  const filteredActions = actions.filter((action) =>
    action.title.toLowerCase().includes(search.toLowerCase())
  );

  // Combine results for keyboard navigation: Notes first, then Actions
  const totalItems = filteredNotes.length + filteredActions.length;

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (totalItems || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + (totalItems || 1)) % (totalItems || 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (totalItems === 0) return;

        if (selectedIndex < filteredNotes.length) {
          const note = filteredNotes[selectedIndex];
          if (onSelectNote && note) {
            onSelectNote(note);
            onClose();
          }
        } else {
          const actionIndex = selectedIndex - filteredNotes.length;
          const action = filteredActions[actionIndex];
          if (action) {
            action.perform();
            onClose();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredNotes, filteredActions, selectedIndex, totalItems, onSelectNote, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] bg-[#1E242E] border border-[#2F3746] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[500px] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="p-3 border-b border-[#2A3240] flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes or commands..."
            className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none px-2 py-1"
          />
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
          {totalItems === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500">
              No matching notes or actions found
            </div>
          ) : (
            <>
              {/* Notes Section (when search query matches notes) */}
              {filteredNotes.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Notes
                  </div>
                  {filteredNotes.map((note, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <div
                        key={note.id}
                        onClick={() => {
                          if (onSelectNote) onSelectNote(note);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between group transition-all ${
                          isSelected
                            ? "bg-[#283242] text-white shadow-sm"
                            : "text-gray-300 hover:bg-[#242C3A]"
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <span className="text-gray-400 group-hover:text-white shrink-0">
                            <NoteSwitcherIcon size={16} />
                          </span>
                          <div className="min-w-0 flex flex-col">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-sm font-medium truncate">
                                {note.title}
                              </span>
                              {note.is_pinned && (
                                <PinIcon size={11} className="text-[var(--accent-color,#0399F7)] shrink-0" />
                              )}
                            </div>
                            {note.content && (
                              <span className="text-[11px] text-gray-400 truncate max-w-[320px]">
                                {note.content.replace(/^[#\s*-_]+/, "").slice(0, 80)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono shrink-0 ml-2">
                          Jump to Note
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions Section */}
              {filteredActions.length > 0 && (
                <div className="space-y-1">
                  {filteredNotes.length > 0 && (
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-t border-[#2A3240]">
                      Commands
                    </div>
                  )}
                  {filteredActions.map((action, actionIdx) => {
                    const overallIndex = filteredNotes.length + actionIdx;
                    const isSelected = overallIndex === selectedIndex;
                    return (
                      <div
                        key={action.id}
                        onClick={() => {
                          action.perform();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(overallIndex)}
                        className={`px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-between group transition-all ${
                          isSelected
                            ? "bg-[#283242] text-white shadow-sm"
                            : "text-gray-300 hover:bg-[#242C3A]"
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <span className="text-gray-400 group-hover:text-white shrink-0">
                            {action.icon}
                          </span>
                          <span className="text-sm font-medium truncate">
                            {action.title}
                          </span>
                        </div>

                        {/* Shortcut Badges */}
                        {action.shortcut && action.shortcut.length > 0 && (
                          <div className="flex items-center space-x-1 shrink-0">
                            {action.shortcut.map((key, i) => (
                              <kbd
                                key={i}
                                className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#161B22] text-gray-400 border border-[#2B3340] rounded shadow-xs"
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
