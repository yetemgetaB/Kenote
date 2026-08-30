import React, { useState, useEffect, useRef } from "react";

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
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  actions,
}) => {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredActions = actions.filter((action) =>
    action.title.toLowerCase().includes(search.toLowerCase())
  );

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
        setSelectedIndex((prev) => (prev + 1) % (filteredActions.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + (filteredActions.length || 1)) % (filteredActions.length || 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredActions[selectedIndex]) {
          filteredActions[selectedIndex].perform();
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredActions, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-[#1E242E] border border-[#2F3746] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[460px] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="p-3 border-b border-[#2A3240] flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for actions..."
            className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none px-2 py-1"
          />
        </div>

        {/* Action List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {filteredActions.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500">
              No actions found
            </div>
          ) : (
            filteredActions.map((action, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={action.id}
                  onClick={() => {
                    action.perform();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
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
            })
          )}
        </div>
      </div>
    </div>
  );
};
