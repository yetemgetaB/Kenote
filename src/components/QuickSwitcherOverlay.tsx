import React, { useEffect, useRef } from "react";
import { NoteMetadata } from "../types/note";
import { PinIcon } from "./Icons";

interface QuickSwitcherOverlayProps {
  isOpen: boolean;
  notes: NoteMetadata[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onClose: () => void;
}

export const QuickSwitcherOverlay: React.FC<QuickSwitcherOverlayProps> = ({
  isOpen,
  notes,
  selectedIndex,
  onSelectIndex,
  onClose,
}) => {
  const activeCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen || notes.length === 0) return null;

  const formatTimestamp = (ts: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - ts;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(ts * 1000).toLocaleDateString();
  };

  // Strip Markdown syntax for clean card snippet preview
  const getCleanSnippet = (content: string) => {
    const stripped = content
      .replace(/^[#>-]+\s+/gm, "")
      .replace(/\[[ x]\]/gi, "")
      .replace(/[*_`~]/g, "")
      .trim();
    return stripped.slice(0, 160) || "Empty note";
  };

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl flex flex-col items-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Indicator */}
        <div className="flex items-center space-x-2 text-xs font-semibold text-gray-400 bg-[#1A202C]/90 px-3 py-1 rounded-full border border-white/10 shadow-lg">
          <span>Release modifier key to switch</span>
          <span className="text-gray-600">•</span>
          <span className="text-[var(--accent-color,#0399F7)]">
            {selectedIndex + 1} of {notes.length}
          </span>
        </div>

        {/* Carousel / Cards Deck */}
        <div className="w-full flex items-center justify-start sm:justify-center overflow-x-auto custom-scrollbar py-3 px-2 space-x-3.5">
          {notes.map((note, index) => {
            const isSelected = index === selectedIndex;
            return (
              <div
                key={note.id}
                ref={isSelected ? activeCardRef : null}
                onClick={() => onSelectIndex(index)}
                className={`relative shrink-0 w-52 h-44 rounded-2xl p-4 flex flex-col justify-between transition-all duration-150 cursor-pointer select-none border ${
                  isSelected
                    ? "bg-[#1E2532] border-[var(--accent-color,#0399F7)] shadow-[0_0_25px_rgba(3,153,247,0.35)] scale-105 z-10"
                    : "bg-[#141923]/90 border-[#2A3342] opacity-60 hover:opacity-90 hover:scale-[1.02]"
                }`}
              >
                {/* Card Header */}
                <div>
                  <div className="flex items-center justify-between space-x-2 mb-1.5">
                    <div className="flex items-center space-x-1.5 min-w-0">
                      {note.is_pinned && (
                        <PinIcon
                          size={12}
                          filled
                          className="text-[var(--accent-color,#0399F7)] shrink-0"
                        />
                      )}
                      <h4
                        className={`text-sm font-bold truncate ${
                          isSelected ? "text-white" : "text-gray-200"
                        }`}
                      >
                        {note.title || "Untitled"}
                      </h4>
                    </div>
                  </div>

                  {/* Snippet Preview */}
                  <p className="text-[11px] text-gray-400 line-clamp-4 leading-relaxed font-sans break-words">
                    {getCleanSnippet(note.content)}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-400">
                  <span>{formatTimestamp(note.updated_at)}</span>
                  <span>{note.character_count} chars</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
