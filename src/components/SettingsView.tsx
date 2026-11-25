import React, { useState, useEffect } from "react";
import { AppSettings, NoteMetadata } from "../types/note";
import { api } from "../utils/tauriBridge";
import { APP_VERSION } from "../utils/version";
import {
  checkForUpdate,
  installUpdate,
  relaunchApp,
  setPendingUpdateTarget,
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
import {
  Palette,
  Sliders,
  Zap,
  HardDrive,
  Trash2,
  Info,
} from "lucide-react";
import {
  clampGlobalZoom,
  clampEditorZoom,
  applyGlobalZoom,
  DEFAULT_GLOBAL_ZOOM,
  DEFAULT_EDITOR_ZOOM,
} from "../utils/zoom";
import { DEFAULT_GLOBAL_SHORTCUT } from "../utils/shortcut";
import { AppearanceTab } from "./settings/AppearanceTab";
import { GeneralTab } from "./settings/GeneralTab";
import { QuickSwitcherTab } from "./settings/QuickSwitcherTab";
import { StorageTab } from "./settings/StorageTab";
import { TrashTab } from "./settings/TrashTab";
import { AboutTab } from "./settings/AboutTab";

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
  const [globalZoom, setGlobalZoom] = useState(settings.global_zoom ?? DEFAULT_GLOBAL_ZOOM);
  const [editorZoom, setEditorZoom] = useState(settings.editor_zoom ?? DEFAULT_EDITOR_ZOOM);

  const [trashedNotes, setTrashedNotes] = useState<NoteMetadata[]>([]);
  const [trashSearch, setTrashSearch] = useState("");
  const [trashActionError, setTrashActionError] = useState<string | null>(null);

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(null);

  const [telemetryEnabled, setTelemetryEnabledState] = useState(settings.telemetry_enabled ?? true);
  const [globalShortcut, setGlobalShortcut] = useState(settings.global_shortcut || "Ctrl+Space");
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [isSavingShortcut, setIsSavingShortcut] = useState(false);
  const [autostartEnabled, setAutostartEnabledState] = useState(false);
  const [isLoadingAutostart, setIsLoadingAutostart] = useState(false);
  const [autostartError, setAutostartError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAutostart = async () => {
      try {
        const enabled = await api.isAutostartEnabled();
        if (isMounted) setAutostartEnabledState(enabled);
      } catch (e) {
        console.error("Failed to check autostart status:", e);
      }
    };
    fetchAutostart();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setGlobalZoom(settings.global_zoom ?? DEFAULT_GLOBAL_ZOOM);
    setEditorZoom(settings.editor_zoom ?? DEFAULT_EDITOR_ZOOM);
    setTelemetryEnabledState(settings.telemetry_enabled ?? true);
    setGlobalShortcut(settings.global_shortcut || "Ctrl+Space");
  }, [settings.global_zoom, settings.editor_zoom, settings.telemetry_enabled, settings.global_shortcut]);

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

  useEffect(() => {
    loadTrash();
  }, [activeTab]);

  const handleSaveGlobalShortcut = async (newShortcut: string) => {
    setIsSavingShortcut(true);
    setShortcutError(null);
    try {
      const registered = await api.updateGlobalShortcut(newShortcut);
      setGlobalShortcut(registered);
      onUpdateSettings({ ...settings, global_shortcut: registered });
      setIsRecordingShortcut(false);
    } catch (err: unknown) {
      const msg =
        typeof err === "string"
          ? err
          : err instanceof Error
          ? err.message
          : "Failed to register shortcut. Your existing shortcut remains active.";
      setShortcutError(msg);
      throw new Error(msg);
    } finally {
      setIsSavingShortcut(false);
    }
  };

  const handleResetGlobalShortcut = async () => {
    if (globalShortcut === DEFAULT_GLOBAL_SHORTCUT || isSavingShortcut) return;
    setIsSavingShortcut(true);
    setShortcutError(null);
    try {
      const registered = await api.updateGlobalShortcut(DEFAULT_GLOBAL_SHORTCUT);
      setGlobalShortcut(registered);
      onUpdateSettings({ ...settings, global_shortcut: registered });
    } catch (err: unknown) {
      const msg =
        typeof err === "string"
          ? err
          : err instanceof Error
          ? err.message
          : "Failed to reset shortcut.";
      setShortcutError(msg);
    } finally {
      setIsSavingShortcut(false);
    }
  };

  const handleToggleAutostart = async (enabled: boolean) => {
    if (isLoadingAutostart) return;
    setIsLoadingAutostart(true);
    setAutostartError(null);
    const prev = autostartEnabled;
    setAutostartEnabledState(enabled);
    try {
      const finalState = await api.setAutostartEnabled(enabled);
      setAutostartEnabledState(finalState);
      trackFeatureUsed("toggle_autostart");
    } catch (err: unknown) {
      setAutostartEnabledState(prev);
      const msg =
        typeof err === "string"
          ? err
          : err instanceof Error
          ? err.message
          : "Failed to update system startup setting.";
      setAutostartError(msg);
    } finally {
      setIsLoadingAutostart(false);
    }
  };

  const handleToggleTelemetry = (enabled: boolean) => {
    setTelemetryEnabledState(enabled);
    setTelemetryEnabled(enabled);
    const updated: AppSettings = { ...settings, telemetry_enabled: enabled };
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

  const handleSaveGlobalZoom = (newZoom: number) => {
    const clamped = clampGlobalZoom(newZoom);
    setGlobalZoom(clamped);
    applyGlobalZoom(clamped);
    const updated = { ...settings, global_zoom: clamped };
    onUpdateSettings(updated);
    api.saveSettings(updated);
  };

  const handleSaveEditorZoom = (newZoom: number) => {
    const clamped = clampEditorZoom(newZoom);
    setEditorZoom(clamped);
    const updated = { ...settings, editor_zoom: clamped };
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
      onRestoreNote?.(restored);
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
        const cleanError = res.error.replace(/([a-zA-Z]:\\[^\s]+)|(\/[^\s]+)/g, "[path]");
        setUpdateErrorMessage(cleanError || "Could not check for updates.");
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
      const raw = err?.message || String(err);
      const cleanError = raw.replace(/([a-zA-Z]:\\[^\s]+)|(\/[^\s]+)/g, "[path]");
      setUpdateErrorMessage(cleanError || "Could not check for updates.");
      trackUpdateFailed("check_failed", "manual");
    }
  };

  const handleInstallUpdate = async () => {
    trackUpdateDownloadStarted(updateInfo?.version || "", "manual");
    const phaseRef: { current: "downloading" | "installing" } = { current: "downloading" };
    setUpdateStatus("downloading");
    setDownloadProgress(0);
    setUpdateErrorMessage(null);
    try {
      await installUpdate(
        (percent) => {
          setDownloadProgress(percent);
        },
        () => {
          phaseRef.current = "installing";
          setUpdateStatus("installing");
        }
      );
      setUpdateStatus("ready_to_restart");
      trackUpdateSucceeded(updateInfo?.version || "");
    } catch (err: any) {
      console.error("Update failed:", err);
      setUpdateStatus("error");
      const raw = err?.message || String(err);
      const cleanError = raw.replace(/([a-zA-Z]:\\[^\s]+)|(\/[^\s]+)/g, "[path]");
      setUpdateErrorMessage(cleanError || "Failed to download and install update.");
      const category = phaseRef.current === "installing" ? "install_failed" : "download_failed";
      trackUpdateFailed(category, "manual");
    }
  };

  const handleRestart = async () => {
    try {
      if (updateInfo) {
        setPendingUpdateTarget(updateInfo.version, APP_VERSION);
      }
      await relaunchApp();
    } catch (err: any) {
      console.error("Failed to relaunch:", err);
    }
  };

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

      {/* Main Settings Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
        <div className="w-full max-w-lg mx-auto space-y-5">
          {activeTab === "appearance" && (
            <AppearanceTab
              accentColor={accentColor}
              fontSize={fontSize}
              lineHeight={lineHeight}
              fontFamily={fontFamily}
              globalZoom={globalZoom}
              editorZoom={editorZoom}
              onSaveColor={handleSaveColor}
              onSaveTypography={handleSaveTypography}
              onSaveGlobalZoom={handleSaveGlobalZoom}
              onSaveEditorZoom={handleSaveEditorZoom}
            />
          )}

          {activeTab === "general" && (
            <GeneralTab
              startupBehavior={startupBehavior}
              startupSpecificNoteId={startupSpecificNoteId}
              notes={notes}
              globalShortcut={globalShortcut}
              isRecordingShortcut={isRecordingShortcut}
              shortcutError={shortcutError}
              isSavingShortcut={isSavingShortcut}
              quickSwitcherMode={quickSwitcherMode}
              quickSwitcherShortcut={quickSwitcherShortcut}
              autostartEnabled={autostartEnabled}
              isLoadingAutostart={isLoadingAutostart}
              autostartError={autostartError}
              telemetryEnabled={telemetryEnabled}
              onSaveStartupBehavior={handleSaveStartupBehavior}
              onStartRecordingShortcut={() => {
                setIsRecordingShortcut(true);
                setShortcutError(null);
              }}
              onCloseRecordingShortcut={() => {
                setIsRecordingShortcut(false);
                setShortcutError(null);
              }}
              onSaveGlobalShortcut={handleSaveGlobalShortcut}
              onResetGlobalShortcut={handleResetGlobalShortcut}
              onToggleAutostart={handleToggleAutostart}
              onToggleTelemetry={handleToggleTelemetry}
            />
          )}

          {activeTab === "quick_switcher" && (
            <QuickSwitcherTab
              quickSwitcherMode={quickSwitcherMode}
              quickSwitcherOrder={quickSwitcherOrder}
              quickSwitcherShortcut={quickSwitcherShortcut}
              onSaveQuickSwitcher={handleSaveQuickSwitcher}
            />
          )}

          {activeTab === "storage" && (
            <StorageTab
              notesCount={notes.length}
              pinnedCount={pinnedCount}
              totalChars={totalChars}
              notesDir={notesDir}
              hasCustomNotesDir={Boolean(settings.custom_notes_dir)}
              onChangeFolder={handleChangeFolder}
              onResetFolder={handleResetFolder}
              onOpenFolder={() => api.revealInExplorer()}
            />
          )}

          {activeTab === "trash" && (
            <TrashTab
              trashedNotes={trashedNotes}
              trashSearch={trashSearch}
              trashActionError={trashActionError}
              onTrashSearchChange={setTrashSearch}
              onEmptyTrash={handleEmptyTrash}
              onRestoreNote={handleRestoreTrashedNote}
              onPermanentDelete={handlePermanentDelete}
            />
          )}

          {activeTab === "about" && (
            <AboutTab
              currentVersion={APP_VERSION}
              updateStatus={updateStatus}
              updateInfo={updateInfo}
              downloadProgress={downloadProgress}
              updateErrorMessage={updateErrorMessage}
              onCheckUpdate={handleCheckUpdate}
              onInstallUpdate={handleInstallUpdate}
              onDismissUpdate={() => setUpdateStatus("idle")}
              onRestart={handleRestart}
              onOpenLink={(url) => api.openExternal(url)}
            />
          )}
        </div>
      </main>
    </div>
  );
};
