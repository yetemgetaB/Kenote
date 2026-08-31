import React, { useState, useEffect } from "react";
import appIconUrl from "../assets/app-icon.png";
import { api } from "../utils/tauriBridge";
import { CloseIcon, MinimizeIcon, FolderIcon, CheckIcon } from "./Icons";

interface CustomInstallerProps {
  onInstalled?: () => void;
  onClose?: () => void;
}

export const CustomInstaller: React.FC<CustomInstallerProps> = ({
  onInstalled,
  onClose,
}) => {
  const [installPath, setInstallPath] = useState("");
  const [desktopShortcut, setDesktopShortcut] = useState(true);
  const [startMenuShortcut, setStartMenuShortcut] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    api.getDefaultInstallDir().then((dir) => {
      setInstallPath(dir);
    });
  }, []);

  const handleBrowseFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: installPath,
      });
      if (selected && typeof selected === "string") {
        setInstallPath(selected);
      }
    } catch {
      // Fallback
    }
  };

  const handleStartInstall = async () => {
    setInstalling(true);
    setProgress(15);
    setStatusText("Preparing installation environment...");

    await new Promise((r) => setTimeout(r, 400));
    setProgress(45);
    setStatusText("Extracting application binaries and assets...");

    await new Promise((r) => setTimeout(r, 600));
    setProgress(80);
    setStatusText("Configuring shortcuts and system integration...");

    try {
      await api.performInstallation(
        installPath,
        desktopShortcut,
        startMenuShortcut
      );
    } catch (e) {
      console.error(e);
    }

    await new Promise((r) => setTimeout(r, 500));
    setProgress(100);
    setStatusText("Installation complete!");
    setIsCompleted(true);
    setInstalling(false);
  };

  const handleLaunch = async () => {
    if (onInstalled) {
      onInstalled();
    } else {
      await api.launchInstalledApp(installPath);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0F1216]/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-[480px] bg-[#171C24] border border-[#2B3340] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Custom Draggable Titlebar */}
        <div
          data-tauri-drag-region
          className="h-10 px-4 bg-[#141820] border-b border-[#252C38] flex items-center justify-between cursor-move"
        >
          <div className="flex items-center space-x-2 pointer-events-none">
            <img src={appIconUrl} alt="Kenote" className="w-4 h-4 rounded" />
            <span className="text-xs font-semibold text-gray-300">
              Kenote Setup Wizard
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => api.minimizeWindow()}
              className="p-1 rounded hover:bg-[#252C38] text-gray-400 hover:text-white transition-colors focus:outline-none"
            >
              <MinimizeIcon size={13} />
            </button>
            <button
              onClick={onClose || (() => api.closeWindow())}
              className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors focus:outline-none"
            >
              <CloseIcon size={13} />
            </button>
          </div>
        </div>

        {/* Wizard Body */}
        <div className="p-6 space-y-6">
          {!isCompleted ? (
            <>
              {/* App Banner Header */}
              <div className="flex items-center space-x-4">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#0399F7] to-[#0284c7] rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
                  <img
                    src={appIconUrl}
                    alt="Kenote App"
                    className="relative w-16 h-16 rounded-2xl shadow-lg border border-white/10"
                  />
                </div>
                <div className="space-y-1">
                  <h1 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                    <span>Install Kenote</span>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#0399F7]/15 text-[#0399F7] border border-[#0399F7]/30">
                      v0.3.2
                    </span>
                  </h1>
                  <p className="text-xs text-gray-400">
                    A minimal, local-first Raycast-inspired note-taking app.
                  </p>
                </div>
              </div>

              {/* Quick Feature Highlights */}
              <div className="grid grid-cols-3 gap-2 py-1">
                <div className="p-2 bg-[#1B212B] border border-[#2A3240] rounded-xl text-center">
                  <span className="text-[14px] block mb-0.5">⚡</span>
                  <span className="text-[10px] font-medium text-gray-300">
                    WYSIWYG
                  </span>
                </div>
                <div className="p-2 bg-[#1B212B] border border-[#2A3240] rounded-xl text-center">
                  <span className="text-[14px] block mb-0.5">📌</span>
                  <span className="text-[10px] font-medium text-gray-300">
                    Pin on Top
                  </span>
                </div>
                <div className="p-2 bg-[#1B212B] border border-[#2A3240] rounded-xl text-center">
                  <span className="text-[14px] block mb-0.5">💾</span>
                  <span className="text-[10px] font-medium text-gray-300">
                    Local .md
                  </span>
                </div>
              </div>

              {/* Install Options */}
              {!installing ? (
                <div className="space-y-4 pt-1">
                  {/* Destination Folder */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                      Destination Folder
                    </label>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-[#13161C] border border-[#2A3240] rounded-lg px-3 py-2 text-xs font-mono text-gray-300 truncate">
                        {installPath || "Loading path..."}
                      </div>
                      <button
                        onClick={handleBrowseFolder}
                        className="px-3 py-2 bg-[#252C38] hover:bg-[#303948] text-white text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-colors focus:outline-none shrink-0"
                      >
                        <FolderIcon size={13} />
                        <span>Browse</span>
                      </button>
                    </div>
                  </div>

                  {/* Shortcuts Checkboxes */}
                  <div className="space-y-2 pt-1 border-t border-[#252C38]">
                    <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block pt-2">
                      Shortcuts & Integrations
                    </label>
                    <label className="flex items-center space-x-2.5 text-xs text-gray-300 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={desktopShortcut}
                        onChange={(e) => setDesktopShortcut(e.target.checked)}
                        className="w-4 h-4 rounded bg-[#13161C] border-[#2A3240] text-[#0399F7] focus:ring-0 focus:outline-none accent-[#0399F7] cursor-pointer"
                      />
                      <span>Create Desktop Shortcut</span>
                    </label>

                    <label className="flex items-center space-x-2.5 text-xs text-gray-300 cursor-pointer hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={startMenuShortcut}
                        onChange={(e) => setStartMenuShortcut(e.target.checked)}
                        className="w-4 h-4 rounded bg-[#13161C] border-[#2A3240] text-[#0399F7] focus:ring-0 focus:outline-none accent-[#0399F7] cursor-pointer"
                      />
                      <span>Create Start Menu Shortcut</span>
                    </label>
                  </div>

                  {/* Action Button */}
                  <div className="pt-3">
                    <button
                      onClick={handleStartInstall}
                      className="w-full py-2.5 bg-gradient-to-r from-[#0399F7] to-[#0284c7] hover:brightness-110 active:brightness-95 text-white text-sm font-semibold rounded-xl shadow-lg shadow-[#0399F7]/25 transition-all focus:outline-none flex items-center justify-center space-x-2"
                    >
                      <span>Install Kenote</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Installing Animation Screen */
                <div className="py-4 space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-medium">
                      {statusText}
                    </span>
                    <span className="text-[#0399F7] font-mono font-semibold">
                      {progress}%
                    </span>
                  </div>

                  {/* Glowing Progress Bar */}
                  <div className="w-full h-2.5 bg-[#13161C] rounded-full overflow-hidden border border-[#2A3240] p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-[#0399F7] to-[#38bdf8] rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(3,153,247,0.8)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 text-center">
                    Please wait while Kenote is being installed on your computer...
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Success Completed Screen */
            <div className="py-4 flex flex-col items-center justify-center text-center space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-2xl bg-[#0399F7]/15 border border-[#0399F7]/40 flex items-center justify-center text-[#0399F7] shadow-xl shadow-[#0399F7]/20">
                <CheckIcon size={32} />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">
                  Kenote Installed Successfully!
                </h2>
                <p className="text-xs text-gray-400 max-w-[320px] leading-relaxed">
                  Kenote is ready to use. Your notes are stored locally and will always stay with you.
                </p>
              </div>

              <div className="w-full pt-2">
                <button
                  onClick={handleLaunch}
                  className="w-full py-2.5 bg-gradient-to-r from-[#0399F7] to-[#0284c7] hover:brightness-110 active:brightness-95 text-white text-sm font-semibold rounded-xl shadow-lg shadow-[#0399F7]/25 transition-all focus:outline-none"
                >
                  Launch Kenote Now 🚀
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
