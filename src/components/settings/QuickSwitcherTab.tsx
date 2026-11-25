import React from "react";
import { Check, Keyboard, Layers, History } from "lucide-react";

interface QuickSwitcherTabProps {
  quickSwitcherMode: "overlay" | "instant" | "disabled";
  quickSwitcherOrder: "mru" | "pinned_updated";
  quickSwitcherShortcut: "ctrl_tab" | "alt_tab" | "ctrl_pagedown";
  onSaveQuickSwitcher: (
    mode: "overlay" | "instant" | "disabled",
    order: "mru" | "pinned_updated",
    shortcut: "ctrl_tab" | "alt_tab" | "ctrl_pagedown"
  ) => void;
}

export const QuickSwitcherTab: React.FC<QuickSwitcherTabProps> = ({
  quickSwitcherMode,
  quickSwitcherOrder,
  quickSwitcherShortcut,
  onSaveQuickSwitcher,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="p-4 bg-[#1B212B] border border-[#2B3442] rounded-2xl space-y-4 shadow-sm">
        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            Quick Note Switcher
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Configure fast keyboard navigation between notes.
          </p>
        </div>

        {/* Switcher Shortcut Selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-gray-300 flex items-center space-x-1.5">
            <Keyboard size={13} className="text-[var(--accent-color,#0399F7)]" />
            <span>Activation Shortcut</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onSaveQuickSwitcher(quickSwitcherMode, quickSwitcherOrder, "ctrl_tab")}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                quickSwitcherShortcut === "ctrl_tab"
                  ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white shadow-sm"
                  : "bg-[#141820] border-[#2B3442] text-gray-300 hover:border-[#384557]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold">Ctrl + Tab</span>
                {quickSwitcherShortcut === "ctrl_tab" && (
                  <Check size={13} className="text-[var(--accent-color,#0399F7)]" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">Standard</span>
            </button>

            <button
              type="button"
              onClick={() => onSaveQuickSwitcher(quickSwitcherMode, quickSwitcherOrder, "alt_tab")}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                quickSwitcherShortcut === "alt_tab"
                  ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white shadow-sm"
                  : "bg-[#141820] border-[#2B3442] text-gray-300 hover:border-[#384557]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold">Alt + Tab</span>
                {quickSwitcherShortcut === "alt_tab" && (
                  <Check size={13} className="text-[var(--accent-color,#0399F7)]" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">Alternative</span>
            </button>

            <button
              type="button"
              onClick={() => onSaveQuickSwitcher(quickSwitcherMode, quickSwitcherOrder, "ctrl_pagedown")}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                quickSwitcherShortcut === "ctrl_pagedown"
                  ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white shadow-sm"
                  : "bg-[#141820] border-[#2B3442] text-gray-300 hover:border-[#384557]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold">Ctrl + PgDn</span>
                {quickSwitcherShortcut === "ctrl_pagedown" && (
                  <Check size={13} className="text-[var(--accent-color,#0399F7)]" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">Page Nav</span>
            </button>
          </div>
        </div>

        {/* Visual Style Selector */}
        <div className="space-y-2 pt-1 border-t border-[#252C38]">
          <label className="text-[11px] font-medium text-gray-300 flex items-center space-x-1.5">
            <Layers size={13} className="text-[var(--accent-color,#0399F7)]" />
            <span>Display Mode</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onSaveQuickSwitcher("overlay", quickSwitcherOrder, quickSwitcherShortcut)}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                quickSwitcherMode === "overlay"
                  ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white shadow-sm"
                  : "bg-[#141820] border-[#2B3442] text-gray-300 hover:border-[#384557]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold">HUD Overlay</span>
                {quickSwitcherMode === "overlay" && (
                  <Check size={13} className="text-[var(--accent-color,#0399F7)]" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">Card Deck</span>
            </button>

            <button
              type="button"
              onClick={() => onSaveQuickSwitcher("instant", quickSwitcherOrder, quickSwitcherShortcut)}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                quickSwitcherMode === "instant"
                  ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white shadow-sm"
                  : "bg-[#141820] border-[#2B3442] text-gray-300 hover:border-[#384557]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold">Instant</span>
                {quickSwitcherMode === "instant" && (
                  <Check size={13} className="text-[var(--accent-color,#0399F7)]" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">No Popup</span>
            </button>

            <button
              type="button"
              onClick={() => onSaveQuickSwitcher("disabled", quickSwitcherOrder, quickSwitcherShortcut)}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                quickSwitcherMode === "disabled"
                  ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white shadow-sm"
                  : "bg-[#141820] border-[#2B3442] text-gray-300 hover:border-[#384557]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold">Disabled</span>
                {quickSwitcherMode === "disabled" && (
                  <Check size={13} className="text-[var(--accent-color,#0399F7)]" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">Turned Off</span>
            </button>
          </div>
        </div>

        {/* Cycle Order Selector */}
        <div className="space-y-2 pt-1 border-t border-[#252C38]">
          <label className="text-[11px] font-medium text-gray-300 flex items-center space-x-1.5">
            <History size={13} className="text-[var(--accent-color,#0399F7)]" />
            <span>Cycle Ordering</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSaveQuickSwitcher(quickSwitcherMode, "mru", quickSwitcherShortcut)}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                quickSwitcherOrder === "mru"
                  ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white shadow-sm"
                  : "bg-[#141820] border-[#2B3442] text-gray-300 hover:border-[#384557]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold">Recently Used (MRU)</span>
                {quickSwitcherOrder === "mru" && (
                  <Check size={13} className="text-[var(--accent-color,#0399F7)]" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">Last focused note first</span>
            </button>

            <button
              type="button"
              onClick={() => onSaveQuickSwitcher(quickSwitcherMode, "pinned_updated", quickSwitcherShortcut)}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                quickSwitcherOrder === "pinned_updated"
                  ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white shadow-sm"
                  : "bg-[#141820] border-[#2B3442] text-gray-300 hover:border-[#384557]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold">List Order</span>
                {quickSwitcherOrder === "pinned_updated" && (
                  <Check size={13} className="text-[var(--accent-color,#0399F7)]" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">Pinned notes first, then date</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
