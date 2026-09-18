import React, { useState } from "react";
import appIconUrl from "../assets/app-icon.png";
import { UpdateInfo, installUpdate, relaunchApp } from "../utils/updater";
import { Sparkles, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  update: UpdateInfo | null;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose, update }) => {
  const [status, setStatus] = useState<"available" | "downloading" | "installing" | "ready" | "error">("available");
  const [progress, setProgress] = useState(0);
  const [downloadedMB, setDownloadedMB] = useState(0);
  const [totalMB, setTotalMB] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !update) return null;

  const handleUpdateNow = async () => {
    setStatus("downloading");
    setErrorMessage(null);
    try {
      await installUpdate(
        (percent, downloaded, total) => {
          setProgress(percent);
          setDownloadedMB(Math.round((downloaded / (1024 * 1024)) * 10) / 10);
          if (total) {
            setTotalMB(Math.round((total / (1024 * 1024)) * 10) / 10);
          }
        },
        () => {
          setStatus("installing");
        }
      );
      setStatus("ready");
    } catch (err: any) {
      console.error("In-app update failed:", err);
      setStatus("error");
      setErrorMessage(err?.message || "Failed to download and install update.");
    }
  };

  const handleRestart = async () => {
    await relaunchApp();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[130] flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div
        className="w-full max-w-[460px] bg-[#171C24] border border-[#2F3746] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Glow & Header */}
        <div className="pt-6 pb-3 px-6 flex flex-col items-center text-center space-y-2.5 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-[#0399F7]/15 to-transparent pointer-events-none" />

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#0399F7] to-[#0284c7] rounded-xl blur opacity-35" />
            <img
              src={appIconUrl}
              alt="Kenote Logo"
              className="relative w-12 h-12 rounded-xl shadow-lg border border-white/10"
            />
          </div>

          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center justify-center space-x-1.5">
              <span>KeNote Update Available</span>
              <Sparkles size={14} className="text-[var(--accent-color,#0399F7)]" />
            </h2>
            <div className="flex items-center justify-center space-x-2 text-xs text-gray-400 mt-1 font-mono">
              <span className="bg-[#212836] px-2 py-0.5 rounded text-gray-300">v{update.currentVersion}</span>
              <span>→</span>
              <span className="bg-[var(--accent-muted,rgba(3,153,247,0.15))] text-[var(--accent-color,#0399F7)] px-2 py-0.5 rounded font-semibold border border-[var(--accent-color,#0399F7)]/30">
                v{update.version}
              </span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-6 py-3 space-y-3 text-xs">
          {status === "available" && (
            <>
              {update.body && (
                <div className="bg-[#12161D] border border-[#26303F] rounded-xl p-3 max-h-36 overflow-y-auto custom-scrollbar text-gray-300 leading-relaxed space-y-1">
                  <div className="text-[11px] font-semibold text-white/90 pb-1 border-b border-[#252E3C]">
                    Release Highlights
                  </div>
                  <p className="text-[11px] text-gray-300 whitespace-pre-wrap">{update.body}</p>
                </div>
              )}
              <p className="text-gray-400 text-center text-[11px]">
                A cryptographically signed update is ready to download and install automatically.
              </p>
            </>
          )}

          {status === "downloading" && (
            <div className="space-y-2 py-2">
              <div className="flex justify-between text-[11px] text-gray-300 font-medium">
                <span>Downloading update...</span>
                <span>{progress}% {totalMB > 0 ? `(${downloadedMB} / ${totalMB} MB)` : ""}</span>
              </div>
              <div className="w-full h-2 bg-[#252E3C] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-color,#0399F7)] transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 text-center">
                Verifying digital signature and package integrity...
              </p>
            </div>
          )}

          {status === "installing" && (
            <div className="flex flex-col items-center justify-center py-4 space-y-2 text-center">
              <RefreshCw size={22} className="text-[var(--accent-color,#0399F7)] animate-spin" />
              <div className="text-sm font-semibold text-white">Installing update...</div>
              <p className="text-[11px] text-gray-400">Applying changes safely to your application.</p>
            </div>
          )}

          {status === "ready" && (
            <div className="flex flex-col items-center justify-center py-3 space-y-2 text-center">
              <CheckCircle2 size={24} className="text-emerald-400" />
              <div className="text-sm font-bold text-white">Update Installed Successfully!</div>
              <p className="text-[11px] text-gray-300">
                Restart KeNote to complete the update. Your notes and settings are preserved.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl space-y-1.5 text-center">
              <AlertTriangle size={18} className="text-red-400 mx-auto" />
              <div className="text-xs font-semibold text-red-400">Update Failed</div>
              <p className="text-[11px] text-gray-300">{errorMessage || "An unexpected error occurred."}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#141820] border-t border-[#27303E] flex items-center justify-end space-x-2">
          {status === "available" && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#252E3C] hover:bg-[#313C4E] text-gray-300 hover:text-white text-xs font-semibold transition-all focus:outline-none border border-[#354152]"
              >
                Later
              </button>
              <button
                onClick={handleUpdateNow}
                className="px-5 py-2 rounded-xl bg-[var(--accent-color,#0399F7)] hover:bg-[var(--accent-hover,#0284c7)] text-white text-xs font-bold shadow-md shadow-[var(--accent-glow,rgba(3,153,247,0.3))] transition-all focus:outline-none flex items-center space-x-1.5"
              >
                <span>Update Now</span>
              </button>
            </>
          )}

          {(status === "downloading" || status === "installing") && (
            <button
              disabled
              className="w-full py-2 rounded-xl bg-[#252E3C] text-gray-400 text-xs font-semibold opacity-60 cursor-not-allowed"
            >
              Updating KeNote...
            </button>
          )}

          {status === "ready" && (
            <button
              onClick={handleRestart}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all focus:outline-none flex items-center justify-center space-x-2"
            >
              <RefreshCw size={13} />
              <span>Restart KeNote Now</span>
            </button>
          )}

          {status === "error" && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#252E3C] hover:bg-[#313C4E] text-gray-300 hover:text-white text-xs font-semibold transition-all focus:outline-none border border-[#354152]"
              >
                Dismiss
              </button>
              <button
                onClick={handleUpdateNow}
                className="px-5 py-2 rounded-xl bg-[var(--accent-color,#0399F7)] hover:bg-[var(--accent-hover,#0284c7)] text-white text-xs font-bold transition-all focus:outline-none"
              >
                Retry Update
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
