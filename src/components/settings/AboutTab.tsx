import React from "react";
import appIconUrl from "../../assets/app-icon.png";
import { UpdateInfo, UpdateStatus } from "../../utils/updater";
import { ReleaseNotesView } from "../ReleaseNotesView";
import {
  Info,
  Github,
  ExternalLink,
  RefreshCw,
  Heart,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface AboutTabProps {
  currentVersion: string;
  updateStatus: UpdateStatus;
  updateInfo: UpdateInfo | null;
  downloadProgress: number;
  updateErrorMessage: string | null;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
  onDismissUpdate: () => void;
  onRestart: () => void;
  onOpenLink: (url: string) => void;
}

export const AboutTab: React.FC<AboutTabProps> = ({
  currentVersion,
  updateStatus,
  updateInfo,
  downloadProgress,
  updateErrorMessage,
  onCheckUpdate,
  onInstallUpdate,
  onDismissUpdate,
  onRestart,
  onOpenLink,
}) => {
  return (
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
                  ? `KeNote is up to date (v${currentVersion}).`
                  : updateStatus === "error"
                  ? "Update check or install could not complete."
                  : "Stay on the latest version."}
              </p>
            </div>
          </div>

          {updateStatus === "ready_to_restart" ? (
            <button
              onClick={onRestart}
              className="px-3 py-1.5 rounded-xl bg-[var(--accent-color,#0399F7)] hover:bg-[var(--accent-hover,#0284c7)] text-white text-xs font-semibold transition-all focus:outline-none shrink-0 shadow-md"
            >
              Restart Now
            </button>
          ) : (
            <button
              onClick={onCheckUpdate}
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
            {updateInfo.body && (
              <div className="bg-[#141922] border border-[#26303F] rounded-lg p-2.5 max-h-36 overflow-hidden flex flex-col space-y-1">
                <div className="text-[11px] font-semibold text-white/90 pb-1 border-b border-[#252E3C] shrink-0">
                  Release Notes
                </div>
                <ReleaseNotesView content={updateInfo.body} maxHeightClass="max-h-28" />
              </div>
            )}
            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={onInstallUpdate}
                className="flex-1 py-2 bg-[var(--accent-color,#0399F7)] hover:bg-[var(--accent-hover,#0284c7)] text-white text-xs font-bold rounded-xl shadow-md transition-all focus:outline-none flex items-center justify-center space-x-2"
              >
                <span>Update Now</span>
              </button>
              <button
                onClick={onDismissUpdate}
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
              onClick={onRestart}
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
              onClick={() => onOpenLink("https://github.com/yetemgetaB/Kenote/releases")}
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
            onClick={() => onOpenLink("https://github.com/yetemgetaB/Kenote")}
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
  );
};
