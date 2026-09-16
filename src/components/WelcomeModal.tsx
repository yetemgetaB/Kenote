import React, { useState } from "react";
import appIconUrl from "../assets/app-icon.png";
import { AppSettings } from "../types/note";
import { api } from "../utils/tauriBridge";
import { trackOnboardingComplete } from "../utils/analytics";
import { APP_VERSION } from "../utils/version";
import { CheckIcon } from "./Icons";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

const DISCOVERY_SOURCES = [
  { id: "reddit", label: "Reddit", icon: "🌐" },
  { id: "github", label: "GitHub", icon: "🐙" },
  { id: "twitter", label: "Twitter / X", icon: "🐦" },
  { id: "producthunt", label: "Product Hunt", icon: "🚀" },
  { id: "friend", label: "Friend / Word of Mouth", icon: "👥" },
  { id: "other", label: "Search / Other", icon: "🔍" },
];

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [selectedSource, setSelectedSource] = useState<string>("reddit");

  if (!isOpen) return null;

  const handleGetStarted = () => {
    trackOnboardingComplete(selectedSource, APP_VERSION);
    const updated: AppSettings = {
      ...settings,
      has_completed_onboarding: true,
      discovery_source: selectedSource,
    };
    onUpdateSettings(updated);
    api.saveSettings(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[120] flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div
        className="w-full max-w-[490px] bg-[#171C24] border border-[#2F3746] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Glow & App Header */}
        <div className="pt-8 pb-4 px-6 flex flex-col items-center text-center space-y-3 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-[#0399F7]/15 to-transparent pointer-events-none" />
          
          <div className="relative group">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-[#0399F7] to-[#0284c7] rounded-2xl blur opacity-40 group-hover:opacity-75 transition duration-500" />
            <img
              src={appIconUrl}
              alt="Kenote Logo"
              className="relative w-16 h-16 rounded-2xl shadow-2xl border border-white/10"
            />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center justify-center space-x-2">
              <span>Welcome to Kenote</span>
              <span className="text-sm">👋</span>
            </h1>
            <p className="text-xs text-gray-400 max-w-[340px] leading-relaxed">
              Your lightning-fast, local-first Raycast-style markdown notepad for Windows.
            </p>
          </div>
        </div>

        {/* Modal Content */}
        <div className="px-6 pb-6 space-y-5">
          {/* Discovery Question */}
          <div className="space-y-2 bg-[#13161C] border border-[#252C38] rounded-xl p-3.5">
            <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block">
              Where did you discover Kenote?
            </label>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {DISCOVERY_SOURCES.map((source) => {
                const isSelected = selectedSource === source.id;
                return (
                  <button
                    key={source.id}
                    onClick={() => setSelectedSource(source.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs transition-all text-left focus:outline-none border ${
                      isSelected
                        ? "bg-[#0399F7]/20 border-[#0399F7] text-white font-medium shadow-sm"
                        : "bg-[#1A202A] border-[#252C38] text-gray-300 hover:bg-[#222A36] hover:text-white"
                    }`}
                  >
                    <span>{source.icon}</span>
                    <span className="truncate">{source.label}</span>
                    {isSelected && (
                      <CheckIcon size={12} className="ml-auto text-[#0399F7]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Shortcuts & Feature Badges */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 bg-[#1A202A] border border-[#252C38] rounded-xl">
              <span className="text-xs font-semibold text-white block mb-0.5">Ctrl + N</span>
              <span className="text-[10px] text-gray-400">New Note</span>
            </div>
            <div className="p-2.5 bg-[#1A202A] border border-[#252C38] rounded-xl">
              <span className="text-xs font-semibold text-white block mb-0.5">Ctrl + O</span>
              <span className="text-[10px] text-gray-400">Browse Notes</span>
            </div>
            <div className="p-2.5 bg-[#1A202A] border border-[#252C38] rounded-xl">
              <span className="text-xs font-semibold text-white block mb-0.5">Ctrl + P</span>
              <span className="text-[10px] text-gray-400">Pin on Top</span>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleGetStarted}
            className="w-full py-2.5 bg-gradient-to-r from-[#0399F7] to-[#0284c7] hover:brightness-110 active:brightness-95 text-white text-sm font-semibold rounded-xl shadow-lg shadow-[#0399F7]/25 transition-all focus:outline-none flex items-center justify-center space-x-2"
          >
            <span>Get Started with Kenote</span>
            <span>🚀</span>
          </button>
        </div>
      </div>
    </div>
  );
};
