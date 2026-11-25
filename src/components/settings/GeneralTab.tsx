import React from "react";
import { NoteMetadata } from "../../types/note";
import { DEFAULT_GLOBAL_SHORTCUT } from "../../utils/shortcut";
import { ShortcutKeyCaps } from "../ShortcutKeyCaps";
import { ShortcutRecorderPopover } from "../ShortcutRecorderPopover";
import {
  Check,
  RotateCcw,
  FileText,
  PlusCircle,
  Bookmark,
  AlertCircle,
} from "lucide-react";

interface GeneralTabProps {
  startupBehavior: "last" | "new" | "specific";
  startupSpecificNoteId: string | null;
  notes: NoteMetadata[];
  globalShortcut: string;
  isRecordingShortcut: boolean;
  shortcutError: string | null;
  isSavingShortcut: boolean;
  quickSwitcherMode: "overlay" | "instant" | "disabled";
  quickSwitcherShortcut: "ctrl_tab" | "alt_tab" | "ctrl_pagedown";
  autostartEnabled: boolean;
  isLoadingAutostart: boolean;
  autostartError: string | null;
  telemetryEnabled: boolean;
  onSaveStartupBehavior: (behavior: "last" | "new" | "specific", specificNoteId?: string | null) => void;
  onStartRecordingShortcut: () => void;
  onCloseRecordingShortcut: () => void;
  onSaveGlobalShortcut: (newShortcut: string) => Promise<void>;
  onResetGlobalShortcut: () => Promise<void>;
  onToggleAutostart: (enabled: boolean) => void;
  onToggleTelemetry: (enabled: boolean) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  startupBehavior,
  startupSpecificNoteId,
  notes,
  globalShortcut,
  isRecordingShortcut,
  shortcutError,
  isSavingShortcut,
  quickSwitcherMode,
  quickSwitcherShortcut,
  autostartEnabled,
  isLoadingAutostart,
  autostartError,
  telemetryEnabled,
  onSaveStartupBehavior,
  onStartRecordingShortcut,
  onCloseRecordingShortcut,
  onSaveGlobalShortcut,
  onResetGlobalShortcut,
  onToggleAutostart,
  onToggleTelemetry,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="p-4 bg-[#1B212B] border border-[#2B3442] rounded-2xl space-y-4 shadow-sm">
        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            Startup Note Launch
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Choose which note Kenote opens on application start.
          </p>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { mode: "last" as const, label: "Last Active", desc: "Resume editing", icon: <FileText size={13} /> },
              { mode: "new" as const, label: "New Note", desc: "Fresh scratchpad", icon: <PlusCircle size={13} /> },
              { mode: "specific" as const, label: "Pinned Note", desc: "Specific document", icon: <Bookmark size={13} /> },
            ].map((opt) => (
              <button
                key={opt.mode}
                type="button"
                onClick={() => {
                  const targetId =
                    opt.mode === "specific" && !startupSpecificNoteId && notes.length > 0
                      ? notes[0].id
                      : startupSpecificNoteId;
                  onSaveStartupBehavior(opt.mode, targetId);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  startupBehavior === opt.mode
                    ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white shadow-sm"
                    : "bg-[#141820] border-[#2B3442] text-gray-300 hover:border-[#384557]"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={startupBehavior === opt.mode ? "text-[var(--accent-color,#0399F7)]" : "text-gray-400"}>
                    {opt.icon}
                  </span>
                  {startupBehavior === opt.mode && (
                    <Check size={13} className="text-[var(--accent-color,#0399F7)]" />
                  )}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-semibold">{opt.label}</div>
                  <div className="text-[9px] text-gray-400 mt-0.5">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {startupBehavior === "specific" && (
            <div className="pt-2 border-t border-[#252C38] animate-in fade-in duration-100">
              <label className="text-[11px] text-gray-300 block mb-1 font-medium">
                Target Document
              </label>
              <select
                value={startupSpecificNoteId || (notes[0]?.id || "")}
                onChange={(e) => onSaveStartupBehavior("specific", e.target.value)}
                className="w-full bg-[#141820] border border-[#2B3442] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--accent-color,#0399F7)]"
              >
                {notes.map((note) => (
                  <option key={note.id} value={note.id}>
                    {note.is_pinned ? "📌 " : ""}{note.title || "Untitled"}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Reference */}
      <div className="p-4 bg-[#1B212B] border border-[#2B3442] rounded-xl space-y-3.5 shadow-sm">
        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            Keybindings
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Navigate and control KeNote with your keyboard.
          </p>
        </div>

        {/* Configurable Shortcuts Group */}
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-[#252C38]">
            <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
              Configurable
            </span>
            <span className="text-[10px] text-gray-500">Click to customize</span>
          </div>

          <div className="relative flex justify-between items-center py-1 text-xs">
            <div>
              <span className="text-gray-300 font-medium">Global Launch</span>
              <p className="text-[11px] text-gray-500">Toggle KeNote window from anywhere</p>
            </div>

            <div className="flex items-center gap-2">
              {globalShortcut !== DEFAULT_GLOBAL_SHORTCUT && (
                <button
                  type="button"
                  onClick={onResetGlobalShortcut}
                  disabled={isSavingShortcut}
                  title={`Reset to default (${DEFAULT_GLOBAL_SHORTCUT.replace(/\+/g, " + ")})`}
                  className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#252D3D] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              <ShortcutKeyCaps
                shortcut={globalShortcut}
                isClickable
                isRecording={isRecordingShortcut}
                onClick={onStartRecordingShortcut}
                hint="Click to customize Global Launch shortcut"
              />

              <ShortcutRecorderPopover
                isOpen={isRecordingShortcut}
                onClose={onCloseRecordingShortcut}
                onSave={onSaveGlobalShortcut}
                currentShortcut={globalShortcut}
                error={shortcutError}
                isSaving={isSavingShortcut}
              />
            </div>
          </div>
        </div>

        {/* Fixed Shortcuts Group */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between pb-1 border-b border-[#252C38]">
            <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
              Fixed
            </span>
            <span className="text-[10px] text-gray-500">Core shortcuts</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
              <span className="text-gray-400">New Note</span>
              <ShortcutKeyCaps shortcut="Ctrl+N" size="sm" />
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
              <span className="text-gray-400">Browse Notes</span>
              <ShortcutKeyCaps shortcut="Ctrl+O" size="sm" />
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
              <span className="text-gray-400">Open External File</span>
              <ShortcutKeyCaps shortcut="Ctrl+Shift+O" size="sm" />
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
              <span className="text-gray-400">Actions Palette</span>
              <ShortcutKeyCaps shortcut="Ctrl+K" size="sm" />
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
              <span className="text-gray-400">Quick Switcher</span>
              {quickSwitcherMode === "disabled" ? (
                <span className="text-[10px] font-mono text-gray-500">Disabled</span>
              ) : (
                <ShortcutKeyCaps
                  shortcut={
                    quickSwitcherShortcut === "alt_tab"
                      ? "Alt+Tab"
                      : quickSwitcherShortcut === "ctrl_pagedown"
                      ? "Ctrl+PgDn"
                      : "Ctrl+Tab"
                  }
                  size="sm"
                />
              )}
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
              <span className="text-gray-400">Find / Replace in Note</span>
              <div className="flex items-center gap-1.5">
                <ShortcutKeyCaps shortcut="Ctrl+F" size="sm" />
                <ShortcutKeyCaps shortcut="Ctrl+H" size="sm" />
              </div>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
              <span className="text-gray-400">Insert Stack / Section</span>
              <ShortcutKeyCaps shortcut="Ctrl+Shift+S" size="sm" />
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
              <span className="text-gray-400">Export Note</span>
              <ShortcutKeyCaps shortcut="Ctrl+Shift+E" size="sm" />
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
              <span className="text-gray-400">Pin Window on Top</span>
              <ShortcutKeyCaps shortcut="Ctrl+P" size="sm" />
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
              <span className="text-gray-400">Zoom In / Out / Reset</span>
              <div className="flex items-center gap-1.5">
                <ShortcutKeyCaps shortcut="Ctrl++" size="sm" />
                <ShortcutKeyCaps shortcut="Ctrl+-" size="sm" />
                <ShortcutKeyCaps shortcut="Ctrl+0" size="sm" />
              </div>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-400">Open Settings</span>
              <ShortcutKeyCaps shortcut="Ctrl+," size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Launch at Login Card */}
      <div className="p-4 bg-[#1B212B] border border-[#2B3442] rounded-xl space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Launch at Login
            </h3>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Launch KeNote quietly in the background when your system starts so your global shortcut is always ready.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autostartEnabled}
            disabled={isLoadingAutostart}
            onClick={() => onToggleAutostart(!autostartEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isLoadingAutostart ? "opacity-50 cursor-not-allowed" : ""
            } ${
              autostartEnabled ? "bg-[var(--accent-color,#0399F7)]" : "bg-[#2A3342]"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                autostartEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {autostartError && (
          <div className="flex items-center space-x-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
            <AlertCircle size={14} className="shrink-0" />
            <span>{autostartError}</span>
          </div>
        )}
      </div>

      {/* Anonymous Usage Statistics Card */}
      <div className="p-4 bg-[#1B212B] border border-[#2B3442] rounded-xl space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Anonymous Usage Statistics
            </h3>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Help improve Kenote by sending anonymous usage statistics such as app launches, feature usage, and update results. Your notes, note contents, filenames, and personal information are never sent.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={telemetryEnabled}
            onClick={() => onToggleTelemetry(!telemetryEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              telemetryEnabled ? "bg-[var(--accent-color,#0399F7)]" : "bg-[#2A3342]"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                telemetryEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
