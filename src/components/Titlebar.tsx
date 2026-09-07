import React from "react";
import {
  ActionTriggerIcon,
  NoteSwitcherIcon,
  PlusIcon,
  PinIcon,
  MinimizeIcon,
  CloseIcon,
  SettingsIcon,
} from "./Icons";

interface TitlebarProps {
  title: string;
  isAlwaysOnTop: boolean;
  isSettingsOpen?: boolean;
  onToggleAlwaysOnTop: () => void;
  onOpenCommandPalette: () => void;
  onOpenNoteSwitcher: () => void;
  onNewNote: () => void;
  onOpenSettings: () => void;
  onCloseSettings?: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  title,
  isAlwaysOnTop,
  isSettingsOpen = false,
  onToggleAlwaysOnTop,
  onOpenCommandPalette,
  onOpenNoteSwitcher,
  onNewNote,
  onOpenSettings,
  onCloseSettings,
  onMinimize,
  onClose,
}) => {
  return (
    <header
      data-tauri-drag-region
      className="h-10 w-full flex items-center justify-between px-3 bg-[#1B2028]/95 border-b border-[#2A313C] select-none z-30 transition-colors"
    >
      {/* Left side actions */}
      <div className="flex items-center space-x-1">
        {isSettingsOpen ? (
          <button
            onClick={onCloseSettings}
            title="Back to Editor (Esc)"
            className="flex items-center space-x-1.5 px-2 py-1 rounded-md text-gray-300 hover:text-white hover:bg-[#2A313D] transition-colors focus:outline-none text-xs font-semibold"
          >
            <span>←</span>
            <span>Editor</span>
          </button>
        ) : (
          <>
            <button
              onClick={onOpenCommandPalette}
              title="Command Menu (Ctrl+K)"
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#2A313D] transition-colors focus:outline-none"
            >
              <ActionTriggerIcon size={15} />
            </button>
            <button
              onClick={onOpenNoteSwitcher}
              title="Browse Notes (Ctrl+O)"
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#2A313D] transition-colors focus:outline-none"
            >
              <NoteSwitcherIcon size={15} />
            </button>
            <button
              onClick={onNewNote}
              title="New Note (Ctrl+N)"
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#2A313D] transition-colors focus:outline-none"
            >
              <PlusIcon size={15} />
            </button>
          </>
        )}
      </div>

      {/* Center dynamic note title / Settings title */}
      <div
        data-tauri-drag-region
        className="flex-1 text-center text-xs font-medium text-gray-300 px-4 truncate pointer-events-none"
      >
        {isSettingsOpen ? "Settings & Preferences" : (title || "Untitled")}
      </div>

      {/* Right side window controls */}
      <div className="flex items-center space-x-1">
        {!isSettingsOpen && (
          <button
            onClick={onOpenSettings}
            title="Settings (Ctrl+,)"
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#2A313D] transition-colors focus:outline-none"
          >
            <SettingsIcon size={14} />
          </button>
        )}

        {/* Pin Always on Top Toggle */}
        <button
          onClick={onToggleAlwaysOnTop}
          title={isAlwaysOnTop ? "Unpin Window (Always on Top Active)" : "Pin Window on Top"}
          className={`p-1.5 rounded-md transition-all focus:outline-none ${
            isAlwaysOnTop
              ? "text-[var(--accent-color,#0399F7)] bg-[var(--accent-muted,rgba(3,153,247,0.15))] shadow-[0_0_10px_var(--accent-glow,rgba(3,153,247,0.3))]"
              : "text-gray-400 hover:text-white hover:bg-[#2A313D]"
          }`}
        >
          <PinIcon size={14} filled={isAlwaysOnTop} />
        </button>

        {/* Minimize */}
        <button
          onClick={onMinimize}
          title="Minimize Window"
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#2A313D] transition-colors focus:outline-none"
        >
          <MinimizeIcon size={14} />
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          title="Close Window"
          className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-colors focus:outline-none"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    </header>
  );
};
