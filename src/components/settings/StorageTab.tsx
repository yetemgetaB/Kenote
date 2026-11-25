import React from "react";
import { Folder, RotateCcw } from "lucide-react";

interface StorageTabProps {
  notesCount: number;
  pinnedCount: number;
  totalChars: number;
  notesDir: string;
  hasCustomNotesDir: boolean;
  onChangeFolder: () => void;
  onResetFolder: () => void;
  onOpenFolder: () => void;
}

export const StorageTab: React.FC<StorageTabProps> = ({
  notesCount,
  pinnedCount,
  totalChars,
  notesDir,
  hasCustomNotesDir,
  onChangeFolder,
  onResetFolder,
  onOpenFolder,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3 bg-[#1B212B] border border-[#2B3442] rounded-xl text-center">
          <span className="text-[10px] text-gray-400 block">Total Notes</span>
          <span className="text-lg font-bold text-white mt-0.5 block">
            {notesCount}
          </span>
        </div>
        <div className="p-3 bg-[#1B212B] border border-[#2B3442] rounded-xl text-center">
          <span className="text-[10px] text-gray-400 block">Pinned</span>
          <span className="text-lg font-bold text-[var(--accent-color,#0399F7)] mt-0.5 block">
            {pinnedCount}
          </span>
        </div>
        <div className="p-3 bg-[#1B212B] border border-[#2B3442] rounded-xl text-center">
          <span className="text-[10px] text-gray-400 block">Characters</span>
          <span className="text-lg font-bold text-white mt-0.5 block">
            {totalChars.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Folder Location Card */}
      <div className="p-4 bg-[#1B212B] border border-[#2B3442] rounded-xl space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Notes Storage Directory
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Saved locally as standard <code className="text-gray-300">.md</code> files.
            </p>
          </div>
          {hasCustomNotesDir && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-muted,rgba(3,153,247,0.15))] text-[var(--accent-color,#0399F7)] border border-[var(--accent-color,#0399F7)]/30 font-medium">
              Custom Location
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-[#141820] border border-[#2B3442] rounded-lg text-xs">
          <span className="font-mono text-gray-300 truncate select-all" title={notesDir}>
            {notesDir}
          </span>
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={onChangeFolder}
              className="px-2.5 py-1.5 rounded-md bg-[var(--accent-color,#0399F7)] hover:bg-[var(--accent-hover,#0284c7)] text-white flex items-center justify-center space-x-1.5 transition-colors focus:outline-none"
            >
              <Folder size={13} />
              <span>Change Folder...</span>
            </button>
            {hasCustomNotesDir && (
              <button
                onClick={onResetFolder}
                className="px-2.5 py-1.5 rounded-md bg-[#242C38] hover:bg-[#303B4C] text-gray-300 hover:text-white flex items-center justify-center space-x-1 transition-colors focus:outline-none"
                title="Reset to default notes folder"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
            <button
              onClick={onOpenFolder}
              className="px-2.5 py-1.5 rounded-md bg-[#242C38] hover:bg-[#303B4C] text-white flex items-center justify-center space-x-1.5 transition-colors focus:outline-none"
            >
              <Folder size={13} />
              <span>Open Folder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
