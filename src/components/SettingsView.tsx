import React, { useState, useEffect } from "react";
import { AppSettings, COLOR_PRESETS, NoteMetadata } from "../types/note";
import { api } from "../utils/tauriBridge";
import { APP_VERSION } from "../utils/version";
import {
  checkForUpdate,
  installUpdate,
  relaunchApp,
  UpdateInfo,
  UpdateStatus,
} from "../utils/updater";
import {
  setTelemetryEnabled,
  trackUpdateCheck,
  trackUpdateAvailable,
  trackUpdateDownloadStarted,
  trackUpdateSucceeded,
  trackUpdateFailed,
  trackFeatureUsed,
} from "../utils/analytics";
import appIconUrl from "../assets/app-icon.png";
import {
  Palette,
  Sliders,
  Zap,
  HardDrive,
  Trash2,
  Info,
  Check,
  Folder,
  RotateCcw,
  Github,
  ExternalLink,
  RefreshCw,
  Heart,
  Sparkles,
  Layers,
  History,
  Keyboard,
  FileText,
  PlusCircle,
  Bookmark,
  Type,
  AlignLeft,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  notesDir: string;
  notes?: NoteMetadata[];
  onClose: () => void;
  onRestoreNote?: (note: NoteMetadata) => void;
}

type TabType =
  | "appearance"
  | "general"
  | "quick_switcher"
  | "storage"
  | "trash"
  | "about";

// Clean and format GitHub release markdown body into structured lines
function formatChangelog(raw: string): { title?: string; items: string[] } {
  if (!raw) return { items: ["General stability and performance improvements."] };
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: string[] = [];
  let title: string | undefined;

  for (const line of lines) {
    if (line.startsWith("#")) {
      if (!title) {
        title = line.replace(/^#+\s*/, "").replace(/[*_]/g, "").trim();
      }
      continue;
    }
    // Bullet items
    if (line.startsWith("-") || line.startsWith("*")) {
      const clean = line.replace(/^[-*]\s*/, "").trim();
      if (clean) items.push(clean);
    } else if (line.length > 0 && !title) {
      title = line;
    } else if (line.length > 0) {
      items.push(line);
    }
  }

  if (items.length === 0) {
    items.push(raw.replace(/^#+\s*/gm, "").trim() || "Performance improvements and bug fixes.");
  }
  return { title, items };
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  notesDir,
  notes = [],
  onRestoreNote,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("appearance");
  const [accentColor, setAccentColor] = useState(settings.accent_color);
  const [fontSize, setFontSize] = useState(settings.font_size);
  const [lineHeight, setLineHeight] = useState(settings.line_height);
  const [fontFamily, setFontFamily] = useState(settings.font_family);
  const [startupBehavior, setStartupBehavior] = useState<"last" | "new" | "specific">(
    settings.startup_behavior || "last"
  );
  const [startupSpecificNoteId, setStartupSpecificNoteId] = useState<string | null>(
    settings.startup_specific_note_id || null
  );
  const [quickSwitcherMode, setQuickSwitcherMode] = useState<"overlay" | "instant" | "disabled">(
    settings.quick_switcher_mode || "overlay"
  );
  const [quickSwitcherOrder, setQuickSwitcherOrder] = useState<"mru" | "pinned_updated">(
    settings.quick_switcher_order || "mru"
  );
  const [quickSwitcherShortcut, setQuickSwitcherShortcut] = useState<
    "ctrl_tab" | "alt_tab" | "ctrl_pagedown"
  >(settings.quick_switcher_shortcut || "ctrl_tab");

  // Trash list state
  const [trashedNotes, setTrashedNotes] = useState<NoteMetadata[]>([]);
  const [trashSearch, setTrashSearch] = useState("");

  // Update check states
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(null);
  const [trashActionError, setTrashActionError] = useState<string | null>(null);
  const [telemetryEnabled, setTelemetryEnabledState] = useState(settings.telemetry_enabled ?? true);
  const currentVersion = APP_VERSION;

  // Sync telemetry state if settings prop changes externally
  useEffect(() => {
    setTelemetryEnabledState(settings.telemetry_enabled ?? true);
  }, [settings.telemetry_enabled]);

  // Load trashed notes when navigating to trash tab or initially
  useEffect(() => {
    loadTrash();
  }, [activeTab]);

  const loadTrash = async () => {
    try {
      const trashed = await api.listTrashedNotes();
      setTrashedNotes(trashed);
      setTrashActionError(null);
    } catch (e) {
      console.error("Failed to load trashed notes:", e);
      setTrashActionError("Failed to load trashed notes.");
    }
  };

  const handleToggleTelemetry = (enabled: boolean) => {
    setTelemetryEnabledState(enabled);
    setTelemetryEnabled(enabled);
    const updated: AppSettings = {
      ...settings,
      telemetry_enabled: enabled,
    };
    onUpdateSettings(updated);
    api.saveSettings(updated);
  };

  const handleSaveStartupBehavior = (
    behavior: "last" | "new" | "specific",
    specificNoteId: string | null = startupSpecificNoteId
  ) => {
    setStartupBehavior(behavior);
    setStartupSpecificNoteId(specificNoteId);
    const updated: AppSettings = {
      ...settings,
      startup_behavior: behavior,
      startup_specific_note_id: specificNoteId,
    };
    onUpdateSettings(updated);
    api.saveSettings(updated);
  };

  const handleSaveQuickSwitcher = (
    mode: "overlay" | "instant" | "disabled",
    order: "mru" | "pinned_updated",
    shortcut: "ctrl_tab" | "alt_tab" | "ctrl_pagedown"
  ) => {
    trackFeatureUsed("quick_switcher");
    setQuickSwitcherMode(mode);
    setQuickSwitcherOrder(order);
    setQuickSwitcherShortcut(shortcut);
    const updated: AppSettings = {
      ...settings,
      quick_switcher_mode: mode,
      quick_switcher_order: order,
      quick_switcher_shortcut: shortcut,
    };
    onUpdateSettings(updated);
    api.saveSettings(updated);
  };

  const handleSaveColor = (color: string) => {
    trackFeatureUsed("change_accent_color");
    setAccentColor(color);
    const updated = { ...settings, accent_color: color };
    onUpdateSettings(updated);
    api.saveSettings(updated);
  };

  const handleSaveTypography = (
    newSize: string,
    newLineHeight: string,
    newFamily: string
  ) => {
    trackFeatureUsed("change_typography");
    setFontSize(newSize);
    setLineHeight(newLineHeight);
    setFontFamily(newFamily);
    const updated = {
      ...settings,
      font_size: newSize,
      line_height: newLineHeight,
      font_family: newFamily,
    };
    onUpdateSettings(updated);
    api.saveSettings(updated);
  };

  const handleChangeFolder = async () => {
    try {
      const selected = await api.selectDirectory(notesDir);
      if (selected && selected.trim().length > 0 && selected.trim() !== notesDir) {
        trackFeatureUsed("change_notes_directory");
        const updated: AppSettings = { ...settings, custom_notes_dir: selected.trim() };
        onUpdateSettings(updated);
        await api.saveSettings(updated);
      }
    } catch (err) {
      console.error("Failed to change notes directory:", err);
    }
  };

  const handleResetFolder = async () => {
    try {
      trackFeatureUsed("reset_notes_directory");
      const updated: AppSettings = { ...settings, custom_notes_dir: null };
      onUpdateSettings(updated);
      await api.saveSettings(updated);
    } catch (err) {
      console.error("Failed to reset notes directory:", err);
    }
  };

  const handleRestoreTrashedNote = async (note: NoteMetadata) => {
    try {
      setTrashActionError(null);
      const restored = await api.restoreNote(note.filename);
      trackFeatureUsed("restore_trashed_note");
      setTrashedNotes((prev) => prev.filter((n) => n.filename !== note.filename));
      if (onRestoreNote) {
        onRestoreNote(restored);
      }
    } catch (err) {
      console.error("Failed to restore note:", err);
      setTrashActionError(`Failed to restore note "${note.title}".`);
    }
  };

  const handlePermanentDelete = async (note: NoteMetadata) => {
    try {
      setTrashActionError(null);
      await api.permanentlyDeleteNote(note.filename);
      trackFeatureUsed("permanently_delete_note");
      setTrashedNotes((prev) => prev.filter((n) => n.filename !== note.filename));
    } catch (err) {
      console.error("Failed to permanently delete note:", err);
      setTrashActionError(`Failed to permanently delete note "${note.title}".`);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      setTrashActionError(null);
      await api.emptyTrash();
      trackFeatureUsed("empty_trash");
      setTrashedNotes([]);
    } catch (err) {
      console.error("Failed to empty trash:", err);
      setTrashActionError("Failed to empty trash.");
    }
  };

  const handleCheckUpdate = async () => {
    trackUpdateCheck("manual");
    setUpdateStatus("checking");
    setUpdateErrorMessage(null);
    try {
      const res = await checkForUpdate();
      if (res.error) {
        setUpdateStatus("error");
        setUpdateErrorMessage(res.error);
        trackUpdateFailed("check_failed", "manual");
      } else if (res.available && res.update) {
        setUpdateInfo(res.update);
        setUpdateStatus("available");
        trackUpdateAvailable(res.update.version, "manual");
      } else {
        setUpdateStatus("up_to_date");
      }
    } catch (err: any) {
      setUpdateStatus("error");
      setUpdateErrorMessage(err?.message || "Could not check for updates.");
      trackUpdateFailed("check_failed", "manual");
    }
  };

  const handleInstallUpdate = async () => {
    trackUpdateDownloadStarted(updateInfo?.version || "", "manual");
    setUpdateStatus("downloading");
    setDownloadProgress(0);
    setUpdateErrorMessage(null);
    try {
      await installUpdate(
        (percent) => {
          setDownloadProgress(percent);
        },
        () => {
          setUpdateStatus("installing");
        }
      );
      setUpdateStatus("ready_to_restart");
      trackUpdateSucceeded(updateInfo?.version || "");
    } catch (err: any) {
      console.error("Update failed:", err);
      setUpdateStatus("error");
      setUpdateErrorMessage(err?.message || "Failed to download and install update.");
      const category = updateStatus === "installing" ? "install_failed" : "download_failed";
      trackUpdateFailed(category, "manual");
    }
  };

  const handleRestart = async () => {
    try {
      await relaunchApp();
    } catch (err: any) {
      console.error("Failed to relaunch:", err);
    }
  };

  const handleOpenLink = async (url: string) => {
    await api.openExternal(url);
  };

  const filteredTrash = trashedNotes.filter(
    (n) =>
      n.title.toLowerCase().includes(trashSearch.toLowerCase()) ||
      n.content.toLowerCase().includes(trashSearch.toLowerCase())
  );

  const totalChars = notes.reduce((acc, n) => acc + (n.character_count || 0), 0);
  const pinnedCount = notes.filter((n) => n.is_pinned).length;

  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "appearance", label: "Appearance", icon: <Palette size={14} /> },
    { id: "general", label: "General", icon: <Sliders size={14} /> },
    { id: "quick_switcher", label: "Switcher", icon: <Zap size={14} /> },
    { id: "storage", label: "Storage", icon: <HardDrive size={14} /> },
    {
      id: "trash",
      label: "Trash",
      icon: <Trash2 size={14} />,
      badge: trashedNotes.length > 0 ? trashedNotes.length : undefined,
    },
    { id: "about", label: "About", icon: <Info size={14} /> },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#16191E] text-gray-200">
      {/* Top Segmented Navigation Tab Bar */}
      <div className="px-2.5 pt-2 pb-1.5 bg-[#1B2028] border-b border-[#262D38] shrink-0 select-none">
        <div
          className="flex items-center space-x-1 overflow-x-auto no-scrollbar"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all focus:outline-none shrink-0 ${
                  isActive
                    ? "bg-[var(--accent-color,#0399F7)] text-white shadow-sm font-semibold"
                    : "text-gray-400 hover:text-white hover:bg-[#252C38]"
                }`}
              >
                <span className={isActive ? "text-white" : "text-gray-400"}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive
                        ? "bg-black/20 text-white"
                        : "bg-[#2A3342] text-gray-300"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Settings Content Area - Responsive for narrow & wide widths */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
        <div className="w-full max-w-lg mx-auto space-y-5">
          {/* Appearance Section */}
          {activeTab === "appearance" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Accent Color Preset Card */}
              <div className="p-4 bg-[#1B212B] border border-[#2B3442] rounded-xl space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                      Accent Color
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Highlights selected items and glow effects.
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-gray-300 bg-[#141820] px-2 py-0.5 rounded-md border border-[#2B3442]">
                    {accentColor.toUpperCase()}
                  </span>
                </div>

                {/* Gradient Preview Bar */}
                <div
                  className="h-6 w-full rounded-lg shadow-inner border border-white/10"
                  style={{
                    background: `linear-gradient(90deg, ${accentColor} 0%, rgba(${parseInt(
                      accentColor.slice(1, 3) || "03",
                      16
                    )}, ${parseInt(accentColor.slice(3, 5) || "99", 16)}, ${parseInt(
                      accentColor.slice(5, 7) || "F7",
                      16
                    )}, 0.2) 100%)`,
                  }}
                />

                {/* Presets Grid - Responsive Wrap */}
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      onClick={() => handleSaveColor(preset.hex)}
                      title={preset.name}
                      className="group relative w-8 h-8 rounded-lg flex items-center justify-center border transition-all hover:scale-105 focus:outline-none shadow-sm shrink-0"
                      style={{
                        backgroundColor: preset.hex,
                        borderColor:
                          accentColor.toLowerCase() === preset.hex.toLowerCase()
                            ? "#FFFFFF"
                            : "transparent",
                      }}
                    >
                      {accentColor.toLowerCase() === preset.hex.toLowerCase() && (
                        <Check size={14} className="text-white drop-shadow-md" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom Hex Picker */}
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => handleSaveColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-[#374151] bg-transparent cursor-pointer p-0.5 shrink-0"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => handleSaveColor(e.target.value)}
                    placeholder="#0399F7"
                    className="flex-1 bg-[#141820] border border-[#2B3442] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--accent-color,#0399F7)] font-mono"
                  />
                </div>
              </div>

              {/* Typography Settings Card */}
              <div className="p-4 bg-[#1B212B] border border-[#2B3442] rounded-2xl space-y-4 shadow-sm">
                <div>
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Editor Typography
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Select font sizing and line spacing for reading comfort.
                  </p>
                </div>

                {/* Font Size Selector */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-gray-300 flex items-center space-x-1.5">
                    <Type size={13} className="text-[var(--accent-color,#0399F7)]" />
                    <span>Font Size</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { size: "14px", label: "Compact" },
                      { size: "15px", label: "Default" },
                      { size: "16px", label: "Medium" },
                      { size: "18px", label: "Large" },
                    ].map((opt) => (
                      <button
                        key={opt.size}
                        type="button"
                        onClick={() => handleSaveTypography(opt.size, lineHeight, fontFamily)}
                        className={`py-2 px-1 rounded-xl border text-center transition-all ${
                          fontSize === opt.size
                            ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white font-semibold shadow-sm"
                            : "bg-[#141820] border-[#2B3442] text-gray-400 hover:text-gray-200 hover:border-[#384557]"
                        }`}
                      >
                        <div className="text-xs">{opt.size}</div>
                        <div className="text-[9px] text-gray-400 mt-0.5">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line Height Selector */}
                <div className="space-y-2 pt-1 border-t border-[#252C38]">
                  <label className="text-[11px] font-medium text-gray-300 flex items-center space-x-1.5">
                    <AlignLeft size={13} className="text-[var(--accent-color,#0399F7)]" />
                    <span>Line Spacing</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { height: "1.4", label: "Tight" },
                      { height: "1.6", label: "Comfortable" },
                      { height: "1.8", label: "Relaxed" },
                    ].map((opt) => (
                      <button
                        key={opt.height}
                        type="button"
                        onClick={() => handleSaveTypography(fontSize, opt.height, fontFamily)}
                        className={`py-2 px-2 rounded-xl border text-center transition-all ${
                          lineHeight === opt.height
                            ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white font-semibold shadow-sm"
                            : "bg-[#141820] border-[#2B3442] text-gray-400 hover:text-gray-200 hover:border-[#384557]"
                        }`}
                      >
                        <div className="text-xs font-semibold">{opt.height}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* General & Startup Section */}
          {activeTab === "general" && (
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
                          const targetId = opt.mode === "specific" && !startupSpecificNoteId && notes.length > 0 ? notes[0].id : startupSpecificNoteId;
                          handleSaveStartupBehavior(opt.mode, targetId);
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
                        onChange={(e) => handleSaveStartupBehavior("specific", e.target.value)}
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
              <div className="p-4 bg-[#1B212B] border border-[#2B3442] rounded-xl space-y-2.5 shadow-sm">
                <div>
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Keybindings
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Essential keyboard shortcuts.
                  </p>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
                    <span className="text-gray-400">New Note</span>
                    <kbd className="font-mono bg-[#141820] px-2 py-0.5 rounded text-gray-300 border border-[#2F3746] text-[11px]">
                      Ctrl + N
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
                    <span className="text-gray-400">Browse Notes</span>
                    <kbd className="font-mono bg-[#141820] px-2 py-0.5 rounded text-gray-300 border border-[#2F3746] text-[11px]">
                      Ctrl + O
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
                    <span className="text-gray-400">Actions Palette</span>
                    <kbd className="font-mono bg-[#141820] px-2 py-0.5 rounded text-gray-300 border border-[#2F3746] text-[11px]">
                      Ctrl + K
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
                    <span className="text-gray-400">Quick Switcher</span>
                    <kbd className="font-mono bg-[#141820] px-2 py-0.5 rounded text-gray-300 border border-[#2F3746] text-[11px]">
                      Ctrl + Tab
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#252C38]">
                    <span className="text-gray-400">Pin Window on Top</span>
                    <kbd className="font-mono bg-[#141820] px-2 py-0.5 rounded text-gray-300 border border-[#2F3746] text-[11px]">
                      Ctrl + P
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-gray-400">Open Settings</span>
                    <kbd className="font-mono bg-[#141820] px-2 py-0.5 rounded text-gray-300 border border-[#2F3746] text-[11px]">
                      Ctrl + ,
                    </kbd>
                  </div>
                </div>
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
                    onClick={() => handleToggleTelemetry(!telemetryEnabled)}
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
          )}

          {/* Quick Switcher Section */}
          {activeTab === "quick_switcher" && (
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
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveQuickSwitcher(quickSwitcherMode, quickSwitcherOrder, "ctrl_tab")}
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
                      <span className="text-[10px] text-gray-400 mt-1">Browser Standard</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveQuickSwitcher(quickSwitcherMode, quickSwitcherOrder, "ctrl_pagedown")}
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
                      <span className="text-[10px] text-gray-400 mt-1">Page Navigation</span>
                    </button>
                  </div>
                </div>

                {/* Visual Style Selector */}
                <div className="space-y-2 pt-1 border-t border-[#252C38]">
                  <label className="text-[11px] font-medium text-gray-300 flex items-center space-x-1.5">
                    <Layers size={13} className="text-[var(--accent-color,#0399F7)]" />
                    <span>Display Mode</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveQuickSwitcher("overlay", quickSwitcherOrder, quickSwitcherShortcut)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        quickSwitcherMode === "overlay"
                          ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white shadow-sm"
                          : "bg-[#141820] border-[#2B3442] text-gray-300 hover:border-[#384557]"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-semibold">Visual HUD Overlay</span>
                        {quickSwitcherMode === "overlay" && (
                          <Check size={13} className="text-[var(--accent-color,#0399F7)]" />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1">Interactive Card Deck</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveQuickSwitcher("instant", quickSwitcherOrder, quickSwitcherShortcut)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        quickSwitcherMode === "instant"
                          ? "bg-[var(--accent-muted,rgba(3,153,247,0.15))] border-[var(--accent-color,#0399F7)] text-white shadow-sm"
                          : "bg-[#141820] border-[#2B3442] text-gray-300 hover:border-[#384557]"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-semibold">Instant Direct Switch</span>
                        {quickSwitcherMode === "instant" && (
                          <Check size={13} className="text-[var(--accent-color,#0399F7)]" />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1">No Popup, Immediate</span>
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
                      onClick={() => handleSaveQuickSwitcher(quickSwitcherMode, "mru", quickSwitcherShortcut)}
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
                      onClick={() => handleSaveQuickSwitcher(quickSwitcherMode, "pinned_updated", quickSwitcherShortcut)}
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
          )}

          {/* Storage & Notes Section */}
          {activeTab === "storage" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Stats Overview */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 bg-[#1B212B] border border-[#2B3442] rounded-xl text-center">
                  <span className="text-[10px] text-gray-400 block">Total Notes</span>
                  <span className="text-lg font-bold text-white mt-0.5 block">
                    {notes.length}
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
                  {settings.custom_notes_dir && (
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
                      onClick={handleChangeFolder}
                      className="px-2.5 py-1.5 rounded-md bg-[var(--accent-color,#0399F7)] hover:bg-[var(--accent-hover,#0284c7)] text-white flex items-center justify-center space-x-1.5 transition-colors focus:outline-none"
                    >
                      <Folder size={13} />
                      <span>Change Folder...</span>
                    </button>
                    {settings.custom_notes_dir && (
                      <button
                        onClick={handleResetFolder}
                        className="px-2.5 py-1.5 rounded-md bg-[#242C38] hover:bg-[#303B4C] text-gray-300 hover:text-white flex items-center justify-center space-x-1 transition-colors focus:outline-none"
                        title="Reset to default notes folder"
                      >
                        <RotateCcw size={12} />
                        <span>Reset</span>
                      </button>
                    )}
                    <button
                      onClick={() => api.revealInExplorer()}
                      className="px-2.5 py-1.5 rounded-md bg-[#242C38] hover:bg-[#303B4C] text-white flex items-center justify-center space-x-1.5 transition-colors focus:outline-none"
                    >
                      <Folder size={13} />
                      <span>Open Folder</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trash Manager Section */}
          {activeTab === "trash" && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Trash Manager
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Recover or delete trashed notes permanently.
                  </p>
                </div>

                {trashedNotes.length > 0 && (
                  <button
                    onClick={handleEmptyTrash}
                    className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-all focus:outline-none"
                  >
                    Empty Trash ({trashedNotes.length})
                  </button>
                )}
              </div>

              {trashActionError && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                  {trashActionError}
                </div>
              )}

              {/* Search Bar for Trash */}
              <input
                type="text"
                value={trashSearch}
                onChange={(e) => setTrashSearch(e.target.value)}
                placeholder="Search trashed notes..."
                className="w-full bg-[#141820] border border-[#2B3442] rounded-xl px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[var(--accent-color,#0399F7)]"
              />

              {/* Trashed Notes List */}
              <div className="space-y-1.5">
                {filteredTrash.length === 0 ? (
                  <div className="p-8 text-center bg-[#1B212B] border border-[#2B3442] rounded-xl text-xs text-gray-500">
                    {trashedNotes.length === 0
                      ? "Trash is empty."
                      : "No matching trashed notes."}
                  </div>
                ) : (
                  filteredTrash.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 bg-[#1B212B] border border-[#2B3442] rounded-xl flex items-center justify-between hover:border-[#384457] transition-all gap-2"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className="text-xs font-semibold text-white truncate">
                          {note.title || "Untitled"}
                        </h4>
                        <div className="text-[10px] text-gray-500 mt-0.5 flex items-center space-x-1.5">
                          <span>{new Date(note.updated_at * 1000).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{note.character_count} chars</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          onClick={() => handleRestoreTrashedNote(note)}
                          className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 flex items-center space-x-1 transition-colors focus:outline-none"
                        >
                          <RotateCcw size={12} />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(note)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-colors focus:outline-none"
                          title="Delete Permanently"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* About & Updates Section */}
          {activeTab === "about" && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* App Brand Hero Card */}
              <div className="p-4 bg-gradient-to-br from-[#1E2633] to-[#161C24] border border-[#2B3545] rounded-2xl flex items-center space-x-4 shadow-md relative overflow-hidden">
                <div className="relative shrink-0">
                  <img
                    src={appIconUrl}
                    alt="Kenote Logo"
                    className="w-14 h-14 rounded-2xl shadow-xl border border-white/10"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-[var(--accent-color,#0399F7)] text-[9px] font-extrabold text-white px-1.5 py-0.2 rounded-full shadow">
                    v{currentVersion}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white tracking-tight">Kenote</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-muted,rgba(3,153,247,0.15))] text-[var(--accent-color,#0399F7)] border border-[var(--accent-color,#0399F7)]/30 font-medium">
                      Desktop
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-1 leading-snug">
                    Lightning-fast, local-first Raycast-inspired markdown notepad.
                  </p>
                </div>
              </div>

              {/* Software Updates Card */}
              <div className="p-4 bg-[#1B212B] border border-[#2B3442] rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-[#242C38] text-[var(--accent-color,#0399F7)]">
                      <RefreshCw
                        size={15}
                        className={
                          updateStatus === "checking" ||
                          updateStatus === "downloading" ||
                          updateStatus === "installing"
                            ? "animate-spin"
                            : ""
                        }
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">App Updates</h4>
                      <p className="text-[11px] text-gray-400">
                        {updateStatus === "checking"
                          ? "Checking for latest release..."
                          : updateStatus === "available"
                          ? `New release v${updateInfo?.version} is available!`
                          : updateStatus === "downloading"
                          ? `Downloading update (${downloadProgress}%)...`
                          : updateStatus === "installing"
                          ? "Verifying and installing update..."
                          : updateStatus === "ready_to_restart"
                          ? "Update installed. Ready to restart!"
                          : updateStatus === "up_to_date"
                          ? "Kenote is up to date."
                          : updateStatus === "error"
                          ? "Update check or install could not complete."
                          : "Stay on the latest version."}
                      </p>
                    </div>
                  </div>

                  {updateStatus === "ready_to_restart" ? (
                    <button
                      onClick={handleRestart}
                      className="px-3 py-1.5 rounded-xl bg-[var(--accent-color,#0399F7)] hover:bg-[var(--accent-hover,#0284c7)] text-white text-xs font-semibold transition-all focus:outline-none shrink-0 shadow-md"
                    >
                      Restart Now
                    </button>
                  ) : (
                    <button
                      onClick={handleCheckUpdate}
                      disabled={
                        updateStatus === "checking" ||
                        updateStatus === "downloading" ||
                        updateStatus === "installing"
                      }
                      className="px-3 py-1.5 rounded-xl bg-[#252E3C] hover:bg-[#313C4E] text-white text-xs font-semibold transition-all focus:outline-none disabled:opacity-50 shrink-0 border border-[#374355]"
                    >
                      {updateStatus === "checking"
                        ? "Checking..."
                        : updateStatus === "downloading" || updateStatus === "installing"
                        ? "Updating..."
                        : "Check Now"}
                    </button>
                  )}
                </div>

                {/* Available Update Banner */}
                {updateStatus === "available" && updateInfo && (
                  <div className="p-3.5 bg-[var(--accent-muted,rgba(3,153,247,0.12))] border border-[var(--accent-color,#0399F7)]/40 rounded-xl space-y-2.5 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center space-x-1">
                        <Sparkles size={13} className="text-[var(--accent-color,#0399F7)]" />
                        <span>Version {updateInfo.version}</span>
                      </span>
                      {updateInfo.date && (
                        <span className="text-[10px] text-gray-400">
                          {new Date(updateInfo.date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {/* Formatted Changelog Notes */}
                    <div className="bg-[#141922] border border-[#26303F] rounded-lg p-2.5 space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                      {(() => {
                        const parsed = formatChangelog(updateInfo.body || "");
                        return (
                          <>
                            {parsed.title && (
                              <div className="text-[11px] font-semibold text-white/90 pb-1 border-b border-[#252E3C]">
                                {parsed.title}
                              </div>
                            )}
                            <ul className="space-y-1 text-[11px] text-gray-300">
                              {parsed.items.map((item, idx) => {
                                const cleanItem = item.replace(/\*\*(.*?)\*\*/g, "$1");
                                return (
                                  <li key={idx} className="flex items-start space-x-1.5 leading-snug">
                                    <span className="text-[var(--accent-color,#0399F7)] text-xs mt-0.5">•</span>
                                    <span>{cleanItem}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        onClick={handleInstallUpdate}
                        className="flex-1 py-2 bg-[var(--accent-color,#0399F7)] hover:bg-[var(--accent-hover,#0284c7)] text-white text-xs font-bold rounded-xl shadow-md transition-all focus:outline-none flex items-center justify-center space-x-2"
                      >
                        <span>Update Now</span>
                      </button>
                      <button
                        onClick={() => setUpdateStatus("idle")}
                        className="px-4 py-2 bg-[#252E3C] hover:bg-[#313C4E] text-gray-300 hover:text-white text-xs font-semibold rounded-xl border border-[#374355] transition-all focus:outline-none"
                      >
                        Later
                      </button>
                    </div>
                  </div>
                )}

                {/* Downloading Progress Banner */}
                {updateStatus === "downloading" && (
                  <div className="p-3.5 bg-[#141922] border border-[#26303F] rounded-xl space-y-2.5 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-white flex items-center space-x-1.5">
                        <RefreshCw size={13} className="animate-spin text-[var(--accent-color,#0399F7)]" />
                        <span>Downloading signed package...</span>
                      </span>
                      <span className="font-bold text-[var(--accent-color,#0399F7)]">
                        {downloadProgress}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#222B38] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent-color,#0399F7)] transition-all duration-200 rounded-full"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Installing Banner */}
                {updateStatus === "installing" && (
                  <div className="p-3.5 bg-[#141922] border border-[#26303F] rounded-xl space-y-2 mt-2 flex items-center space-x-3">
                    <div className="w-4 h-4 border-2 border-[var(--accent-color,#0399F7)] border-t-transparent rounded-full animate-spin shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-white">Installing Update</div>
                      <p className="text-[11px] text-gray-400">
                        Verifying signature and installing package...
                      </p>
                    </div>
                  </div>
                )}

                {/* Ready to Restart Banner */}
                {updateStatus === "ready_to_restart" && (
                  <div className="p-3.5 bg-green-500/10 border border-green-500/30 rounded-xl space-y-2.5 mt-2">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                      <div className="text-xs font-semibold text-green-300">
                        Update Ready to Apply
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-300">
                      The update has been installed successfully. Restart KeNote to complete.
                    </p>
                    <button
                      onClick={handleRestart}
                      className="w-full py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-xl shadow-md transition-all focus:outline-none"
                    >
                      Restart KeNote Now
                    </button>
                  </div>
                )}

                {/* Update Error Banner */}
                {updateStatus === "error" && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1.5 mt-2">
                    <div className="text-xs font-semibold text-red-400 flex items-center space-x-1.5">
                      <AlertCircle size={13} />
                      <span>Update Failed</span>
                    </div>
                    <p className="text-[11px] text-gray-300">
                      {updateErrorMessage || "Could not check or install update. Please try again later."}
                    </p>
                    <button
                      onClick={() => api.openExternal("https://github.com/yetemgetaB/Kenote/releases")}
                      className="text-[11px] text-[var(--accent-color,#0399F7)] hover:underline flex items-center space-x-1 pt-0.5"
                    >
                      <span>View releases on GitHub</span>
                      <ExternalLink size={10} />
                    </button>
                  </div>
                )}
              </div>

              {/* Links & Details Card */}
              <div className="p-3 bg-[#1B212B] border border-[#2B3442] rounded-2xl divide-y divide-[#252C38] text-xs">
                <div className="flex items-center justify-between py-2 px-1">
                  <span className="text-gray-400 flex items-center space-x-2">
                    <Heart size={13} className="text-red-400" />
                    <span>Created by</span>
                  </span>
                  <span className="text-gray-200 font-medium">Yetemgeta Bekele</span>
                </div>

                <div className="flex items-center justify-between py-2 px-1">
                  <span className="text-gray-400 flex items-center space-x-2">
                    <Github size={13} className="text-gray-300" />
                    <span>Source Code</span>
                  </span>
                  <button
                    onClick={() => handleOpenLink("https://github.com/yetemgetaB/Kenote")}
                    className="text-[var(--accent-color,#0399F7)] hover:underline focus:outline-none flex items-center space-x-1 font-medium"
                  >
                    <span>yetemgetaB/Kenote</span>
                    <ExternalLink size={11} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-2 px-1">
                  <span className="text-gray-400 flex items-center space-x-2">
                    <Info size={13} className="text-gray-400" />
                    <span>License</span>
                  </span>
                  <span className="text-gray-300 font-medium">MIT (Free & Open Source)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
