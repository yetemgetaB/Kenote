import React, { useState } from "react";
import { AppSettings, COLOR_PRESETS } from "../types/note";
import { CloseIcon, FolderIcon, CheckIcon } from "./Icons";
import { api } from "../utils/tauriBridge";
import appIconUrl from "../assets/app-icon.png";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  notesDir: string;
  onOpenInstaller?: () => void;
}

type TabType = "appearance" | "storage" | "about";

interface ReleaseInfo {
  version: string;
  name: string;
  body: string;
  url: string;
  publishedAt: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  notesDir,
  onOpenInstaller,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("appearance");
  const [accentColor, setAccentColor] = useState(settings.accent_color);
  const [fontSize, setFontSize] = useState(settings.font_size);
  const [lineHeight, setLineHeight] = useState(settings.line_height);
  const [fontFamily, setFontFamily] = useState(settings.font_family);

  // Update check states
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<"idle" | "up_to_date" | "available" | "error">("idle");
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);
  const currentVersion = "0.2.0";

  if (!isOpen) return null;

  const handleSaveColor = (color: string) => {
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

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatus("idle");
    try {
      const response = await fetch(
        "https://api.github.com/repos/yetemgetaB/Kenote/releases/latest"
      );
      if (!response.ok) {
        if (response.status === 404) {
          // No releases yet
          setUpdateStatus("up_to_date");
          return;
        }
        throw new Error("Failed to check release");
      }
      const data = await response.json();
      const tagName = data.tag_name || "";
      const latestVer = tagName.replace(/^v/, "").trim();

      if (latestVer && latestVer !== currentVersion) {
        setLatestRelease({
          version: latestVer,
          name: data.name || `Version ${latestVer}`,
          body: data.body || "New features and performance improvements.",
          url: data.html_url || "https://github.com/yetemgetaB/Kenote/releases",
          publishedAt: data.published_at ? new Date(data.published_at).toLocaleDateString() : "",
        });
        setUpdateStatus("available");
      } else {
        setUpdateStatus("up_to_date");
      }
    } catch {
      setUpdateStatus("up_to_date"); // Fallback for offline / before first release
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleOpenLink = async (url: string) => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] bg-[#1E242E] border border-[#2F3746] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[600px] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Tabs */}
        <div className="px-5 pt-3.5 pb-0 border-b border-[#2A3240] flex flex-col">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
              <span>Settings</span>
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#2A3240] transition-colors focus:outline-none"
            >
              <CloseIcon size={15} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-4 text-xs font-medium text-gray-400">
            <button
              onClick={() => setActiveTab("appearance")}
              className={`pb-2.5 border-b-2 transition-all focus:outline-none ${
                activeTab === "appearance"
                  ? "border-[var(--accent-color,#0399F7)] text-white font-semibold"
                  : "border-transparent hover:text-gray-200"
              }`}
            >
              Appearance & Color
            </button>
            <button
              onClick={() => setActiveTab("storage")}
              className={`pb-2.5 border-b-2 transition-all focus:outline-none ${
                activeTab === "storage"
                  ? "border-[var(--accent-color,#0399F7)] text-white font-semibold"
                  : "border-transparent hover:text-gray-200"
              }`}
            >
              Storage & Text
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`pb-2.5 border-b-2 transition-all focus:outline-none ${
                activeTab === "about"
                  ? "border-[var(--accent-color,#0399F7)] text-white font-semibold"
                  : "border-transparent hover:text-gray-200"
              }`}
            >
              About & Updates
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6 text-xs text-gray-300">
          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <div className="space-y-5">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white uppercase tracking-wider">
                    Accent Color & Gradient
                  </label>
                  <span className="font-mono text-[11px] text-gray-400">
                    {accentColor.toUpperCase()}
                  </span>
                </div>

                {/* Gradient Preview Bar */}
                <div
                  className="h-6 w-full rounded-lg shadow-inner border border-white/10"
                  style={{
                    background: `linear-gradient(90deg, ${accentColor} 0%, rgba(${
                      parseInt(accentColor.slice(1, 3) || "03", 16)
                    }, ${parseInt(accentColor.slice(3, 5) || "99", 16)}, ${
                      parseInt(accentColor.slice(5, 7) || "F7", 16)
                    }, 0.2) 100%)`,
                  }}
                />

                {/* Presets Grid */}
                <div className="grid grid-cols-6 gap-2 pt-1">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      onClick={() => handleSaveColor(preset.hex)}
                      title={preset.name}
                      className="group relative h-9 rounded-xl flex items-center justify-center border transition-all hover:scale-105 focus:outline-none"
                      style={{
                        backgroundColor: preset.hex,
                        borderColor:
                          accentColor.toLowerCase() === preset.hex.toLowerCase()
                            ? "#FFFFFF"
                            : "transparent",
                      }}
                    >
                      {accentColor.toLowerCase() === preset.hex.toLowerCase() && (
                        <CheckIcon size={14} className="text-white drop-shadow-md" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom Hex Picker */}
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => handleSaveColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-[#374151] bg-transparent cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => handleSaveColor(e.target.value)}
                    placeholder="#0399F7"
                    className="flex-1 bg-[#171C24] border border-[#2B3340] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--accent-color,#0399F7)] font-mono"
                  />
                </div>
              </section>

              {/* Shortcuts Reference */}
              <section className="space-y-2 border-t border-[#2A3240] pt-4">
                <label className="text-xs font-semibold text-white uppercase tracking-wider">
                  Keyboard Shortcuts
                </label>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-400">New Note</span>
                    <kbd className="font-mono bg-[#161B22] px-1.5 py-0.5 rounded border border-[#2B3340] text-gray-300">Ctrl + N</kbd>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-400">Browse Notes</span>
                    <kbd className="font-mono bg-[#161B22] px-1.5 py-0.5 rounded border border-[#2B3340] text-gray-300">Ctrl + O</kbd>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-400">Actions Palette</span>
                    <kbd className="font-mono bg-[#161B22] px-1.5 py-0.5 rounded border border-[#2B3340] text-gray-300">Ctrl + K</kbd>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-400">Toggle Always on Top</span>
                    <kbd className="font-mono bg-[#161B22] px-1.5 py-0.5 rounded border border-[#2B3340] text-gray-300">Ctrl + P</kbd>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-400">Open Settings</span>
                    <kbd className="font-mono bg-[#161B22] px-1.5 py-0.5 rounded border border-[#2B3340] text-gray-300">Ctrl + ,</kbd>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Storage & Typography Tab */}
          {activeTab === "storage" && (
            <div className="space-y-5">
              <section className="space-y-2">
                <label className="text-xs font-semibold text-white uppercase tracking-wider">
                  Local Markdown Storage
                </label>
                <p className="text-[11px] text-gray-400">
                  All notes are stored locally in standard Markdown <code className="text-gray-300">.md</code> format.
                </p>
                <div className="flex items-center justify-between p-2.5 bg-[#171C24] border border-[#2B3340] rounded-xl text-[11px]">
                  <span className="font-mono text-gray-300 truncate max-w-[280px]">
                    {notesDir}
                  </span>
                  <button
                    onClick={() => api.revealInExplorer()}
                    className="px-2.5 py-1 rounded-lg bg-[#252C38] hover:bg-[#303948] text-white flex items-center space-x-1.5 transition-colors focus:outline-none shrink-0"
                  >
                    <FolderIcon size={12} />
                    <span>Open Folder</span>
                  </button>
                </div>
              </section>

              {/* Typography */}
              <section className="space-y-3 border-t border-[#2A3240] pt-4">
                <label className="text-xs font-semibold text-white uppercase tracking-wider">
                  Typography & Layout
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-gray-400 block mb-1">Font Size</span>
                    <select
                      value={fontSize}
                      onChange={(e) =>
                        handleSaveTypography(e.target.value, lineHeight, fontFamily)
                      }
                      className="w-full bg-[#171C24] border border-[#2B3340] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="14px">14px - Compact</option>
                      <option value="15px">15px - Default</option>
                      <option value="16px">16px - Medium</option>
                      <option value="18px">18px - Large</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[11px] text-gray-400 block mb-1">Line Height</span>
                    <select
                      value={lineHeight}
                      onChange={(e) =>
                        handleSaveTypography(fontSize, e.target.value, fontFamily)
                      }
                      className="w-full bg-[#171C24] border border-[#2B3340] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="1.4">1.4 - Tight</option>
                      <option value="1.6">1.6 - Comfortable</option>
                      <option value="1.8">1.8 - Relaxed</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* About & Updates Tab */}
          {activeTab === "about" && (
            <div className="space-y-6">
              {/* App Brand Header */}
              <div className="flex flex-col items-center justify-center text-center space-y-2.5 pt-2">
                <img
                  src={appIconUrl}
                  alt="Kenote Logo"
                  className="w-16 h-16 rounded-2xl shadow-xl border border-white/10"
                />
                <div>
                  <h3 className="text-base font-bold text-white">Kenote</h3>
                  <p className="text-xs text-gray-400">
                    Version <span className="font-mono text-[var(--accent-color,#0399F7)]">{currentVersion}</span>
                  </p>
                </div>
                <p className="text-[11px] text-gray-400 max-w-[320px] leading-relaxed">
                  A lightning-fast, local-first Raycast-inspired markdown note-taking desktop application for Windows.
                </p>
              </div>

              {/* Updates Section */}
              <section className="p-3.5 bg-[#171C24] border border-[#2B3340] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-white">Software Updates</h4>
                    <p className="text-[11px] text-gray-400">
                      {checkingUpdate
                        ? "Checking for new releases..."
                        : updateStatus === "available"
                        ? `New version ${latestRelease?.version} available!`
                        : updateStatus === "up_to_date"
                        ? "Kenote is up to date."
                        : "Check for the latest features & fixes."}
                    </p>
                  </div>

                  <button
                    onClick={handleCheckUpdate}
                    disabled={checkingUpdate}
                    className="px-3 py-1.5 rounded-lg bg-[#252C38] hover:bg-[#323C4D] text-white text-xs font-medium transition-all focus:outline-none disabled:opacity-50 shrink-0"
                  >
                    {checkingUpdate ? "Checking..." : "Check for Updates"}
                  </button>
                </div>

                {/* Available Update Card */}
                {updateStatus === "available" && latestRelease && (
                  <div className="p-3 bg-[var(--accent-muted,rgba(3,153,247,0.15))] border border-[var(--accent-color,#0399F7)]/40 rounded-lg space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-xs">
                        {latestRelease.name}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {latestRelease.publishedAt}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300 line-clamp-3">
                      {latestRelease.body}
                    </p>
                    <button
                      onClick={() => handleOpenLink(latestRelease.url)}
                      className="w-full py-1.5 bg-[var(--accent-color,#0399F7)] hover:bg-[var(--accent-hover,#0284c7)] text-white text-xs font-semibold rounded-md shadow-sm transition-all focus:outline-none"
                    >
                      Download & Update Now
                    </button>
                  </div>
                )}
              </section>

              {/* Developer & Links */}
              <section className="space-y-2 border-t border-[#2A3240] pt-4 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Developer</span>
                  <span className="text-gray-200 font-medium">yetemgetaB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">GitHub Repository</span>
                  <button
                    onClick={() =>
                      handleOpenLink("https://github.com/yetemgetaB/Kenote")
                    }
                    className="text-[var(--accent-color,#0399F7)] hover:underline focus:outline-none"
                  >
                    yetemgetaB/Kenote
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">License</span>
                  <span className="text-gray-300">MIT</span>
                </div>
                {onOpenInstaller && (
                  <div className="pt-2 border-t border-[#2A3240]">
                    <button
                      onClick={() => {
                        onClose();
                        onOpenInstaller();
                      }}
                      className="w-full py-1.5 bg-[#252C38] hover:bg-[#323C4D] text-gray-300 hover:text-white rounded-lg text-[11px] transition-colors focus:outline-none flex items-center justify-center space-x-1.5"
                    >
                      <span>⚡</span>
                      <span>Run Kenote Setup Wizard & Shortcuts</span>
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
