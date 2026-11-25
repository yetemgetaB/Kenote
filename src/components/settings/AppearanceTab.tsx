import React from "react";
import { COLOR_PRESETS } from "../../types/note";
import { Check, Type, AlignLeft, ZoomIn, Minus, Plus, FileText } from "lucide-react";
import {
  incrementGlobalZoom,
  decrementGlobalZoom,
  incrementEditorZoom,
  decrementEditorZoom,
  DEFAULT_GLOBAL_ZOOM,
  DEFAULT_EDITOR_ZOOM,
} from "../../utils/zoom";

interface AppearanceTabProps {
  accentColor: string;
  fontSize: string;
  lineHeight: string;
  fontFamily: string;
  globalZoom: number;
  editorZoom: number;
  onSaveColor: (color: string) => void;
  onSaveTypography: (size: string, lineHeight: string, family: string) => void;
  onSaveGlobalZoom: (zoom: number) => void;
  onSaveEditorZoom: (zoom: number) => void;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  accentColor,
  fontSize,
  lineHeight,
  fontFamily,
  globalZoom,
  editorZoom,
  onSaveColor,
  onSaveTypography,
  onSaveGlobalZoom,
  onSaveEditorZoom,
}) => {
  return (
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

        {/* Presets Grid */}
        <div className="flex flex-wrap gap-2 pt-0.5">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.hex}
              onClick={() => onSaveColor(preset.hex)}
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
            onChange={(e) => onSaveColor(e.target.value)}
            className="w-8 h-8 rounded-lg border border-[#374151] bg-transparent cursor-pointer p-0.5 shrink-0"
          />
          <input
            type="text"
            value={accentColor}
            onChange={(e) => onSaveColor(e.target.value)}
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
                onClick={() => onSaveTypography(opt.size, lineHeight, fontFamily)}
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
                onClick={() => onSaveTypography(fontSize, opt.height, fontFamily)}
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

      {/* Zoom & Scaling Settings Card */}
      <div className="p-4 bg-[#1B212B] border border-[#2B3442] rounded-2xl space-y-4 shadow-sm">
        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            Zoom & Scaling
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Adjust interface and document display scale independently.
          </p>
        </div>

        {/* Global Zoom */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-gray-300 flex items-center space-x-1.5">
              <ZoomIn size={13} className="text-[var(--accent-color,#0399F7)]" />
              <span>Global Zoom (Application)</span>
            </label>
            <span className="font-mono text-[11px] text-gray-300 bg-[#141820] px-2 py-0.5 rounded-md border border-[#2B3442]">
              {globalZoom}%
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => onSaveGlobalZoom(decrementGlobalZoom(globalZoom))}
              className="p-2 rounded-lg bg-[#141820] border border-[#2B3442] text-gray-300 hover:text-white hover:border-[#384557] focus:outline-none shrink-0"
              title="Zoom Out (Ctrl -)"
            >
              <Minus size={14} />
            </button>
            <div className="flex-1 text-center text-xs text-gray-400">
              Entire UI, navigation, and dialogs
            </div>
            <button
              type="button"
              onClick={() => onSaveGlobalZoom(incrementGlobalZoom(globalZoom))}
              className="p-2 rounded-lg bg-[#141820] border border-[#2B3442] text-gray-300 hover:text-white hover:border-[#384557] focus:outline-none shrink-0"
              title="Zoom In (Ctrl +)"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={() => onSaveGlobalZoom(DEFAULT_GLOBAL_ZOOM)}
              className="px-2.5 py-1.5 rounded-lg bg-[#141820] border border-[#2B3442] text-[11px] text-gray-400 hover:text-white hover:border-[#384557] focus:outline-none shrink-0"
              title="Reset Global Zoom (Ctrl 0)"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Editor Zoom */}
        <div className="space-y-2 pt-2 border-t border-[#252C38]">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-gray-300 flex items-center space-x-1.5">
              <FileText size={13} className="text-[var(--accent-color,#0399F7)]" />
              <span>Editor Zoom (Document Only)</span>
            </label>
            <span className="font-mono text-[11px] text-gray-300 bg-[#141820] px-2 py-0.5 rounded-md border border-[#2B3442]">
              {editorZoom}%
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => onSaveEditorZoom(decrementEditorZoom(editorZoom))}
              className="p-2 rounded-lg bg-[#141820] border border-[#2B3442] text-gray-300 hover:text-white hover:border-[#384557] focus:outline-none shrink-0"
              title="Editor Zoom Out"
            >
              <Minus size={14} />
            </button>
            <div className="flex-1 text-center text-xs text-gray-400">
              Note markdown text content only
            </div>
            <button
              type="button"
              onClick={() => onSaveEditorZoom(incrementEditorZoom(editorZoom))}
              className="p-2 rounded-lg bg-[#141820] border border-[#2B3442] text-gray-300 hover:text-white hover:border-[#384557] focus:outline-none shrink-0"
              title="Editor Zoom In"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={() => onSaveEditorZoom(DEFAULT_EDITOR_ZOOM)}
              className="px-2.5 py-1.5 rounded-lg bg-[#141820] border border-[#2B3442] text-[11px] text-gray-400 hover:text-white hover:border-[#384557] focus:outline-none shrink-0"
              title="Reset Editor Zoom"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
