import React from "react";
import { splitShortcutToKeys } from "../utils/shortcut";

export interface ShortcutKeyCapsProps {
  /** The shortcut as a string ("Alt+Shift+K") or array of keys (["Alt", "Shift", "K"]) */
  shortcut?: string | string[];
  /** Whether clicking the shortcut triggers customization */
  isClickable?: boolean;
  /** Whether the shortcut is currently in recording mode */
  isRecording?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Size variant */
  size?: "sm" | "md";
  /** Optional tooltip hint */
  hint?: string;
  /** Custom class names */
  className?: string;
  /** Optional placeholder when no keys are provided */
  placeholder?: string;
}

function formatKeyLabel(key: string): string {
  const trimmed = key.trim();
  if (trimmed === "Super" || trimmed === "Meta") return "Win";
  if (trimmed === "Control") return "Ctrl";
  if (trimmed === "Escape") return "Esc";
  return trimmed;
}

export const ShortcutKeyCaps: React.FC<ShortcutKeyCapsProps> = ({
  shortcut,
  isClickable = false,
  isRecording = false,
  onClick,
  size = "md",
  hint,
  className = "",
  placeholder,
}) => {
  const keys = shortcut ? splitShortcutToKeys(shortcut) : [];

  const keyCapClasses = `inline-flex items-center justify-center font-mono font-medium rounded-[4px] select-none
    bg-[#181D26] text-gray-200 border border-[#2F3746]
    shadow-[0_1.5px_0_0_#0D1117,0_1px_2px_rgba(0,0,0,0.5)]
    transition-colors duration-150
    ${isClickable ? "group-hover:border-[#4B5565] group-hover:text-white" : ""}
    ${size === "sm" ? "px-1.5 py-0.5 text-[10px] min-w-[20px] h-[20px]" : "px-2 py-0.5 text-[11px] min-w-[24px] h-[22px]"}`;

  const content = (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {keys.length > 0 ? (
        keys.map((k, idx) => (
          <React.Fragment key={`${k}-${idx}`}>
            <kbd className={keyCapClasses}>{formatKeyLabel(k)}</kbd>
          </React.Fragment>
        ))
      ) : placeholder ? (
        <span className="text-[11px] text-gray-500 italic">{placeholder}</span>
      ) : null}
    </div>
  );

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={hint || "Click to customize shortcut"}
        aria-label={hint || `Customize shortcut: ${keys.join(" + ")}`}
        className={`group inline-flex items-center gap-1.5 rounded-lg p-1 -m-1 transition-all duration-150 outline-none
          cursor-pointer hover:bg-[#1E2533] focus-visible:ring-1 focus-visible:ring-sky-500
          active:translate-y-[1px]
          ${isRecording ? "ring-1 ring-sky-500 bg-[#1E2533]" : ""}`}
      >
        {content}
      </button>
    );
  }

  return content;
};
