import React, { useEffect, useRef } from "react";
import { ShortcutKeyCaps } from "./ShortcutKeyCaps";
import { parseKeyboardEventToShortcut } from "../utils/shortcut";
import { AlertCircle, X } from "lucide-react";

export interface ShortcutRecorderPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shortcut: string) => Promise<void>;
  currentShortcut: string;
  isSaving?: boolean;
  error?: string | null;
}

export const ShortcutRecorderPopover: React.FC<ShortcutRecorderPopoverProps> = ({
  isOpen,
  onClose,
  onSave,
  currentShortcut,
  isSaving = false,
  error = null,
}) => {
  const [pressedKeys, setPressedKeys] = React.useState<string[]>([]);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setPressedKeys([]);
      setLocalError(null);
      return;
    }

    const handleKeyDown = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        onClose();
        return;
      }

      const parsed = parseKeyboardEventToShortcut(e);

      if (parsed.isEscape) {
        onClose();
        return;
      }

      if (parsed.isModifierOnly) {
        const mods: string[] = [];
        if (e.ctrlKey) mods.push("Ctrl");
        if (e.altKey) mods.push("Alt");
        if (e.shiftKey) mods.push("Shift");
        if (e.metaKey) mods.push("Win");
        setPressedKeys(mods);
        setLocalError(null);
        return;
      }

      if (!parsed.isValid || !parsed.shortcut) {
        if (parsed.error) {
          setLocalError(parsed.error);
        }
        return;
      }

      const shortcut = parsed.shortcut;
      setPressedKeys(shortcut.split("+"));
      setLocalError(null);

      try {
        await onSave(shortcut);
      } catch (err: unknown) {
        const msg = typeof err === "string" ? err : err instanceof Error ? err.message : "Failed to register shortcut.";
        setLocalError(msg);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("mousedown", handleClickOutside, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [isOpen, onClose, onSave]);

  if (!isOpen) return null;

  const displayError = localError || error;

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-72 p-3.5 bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 duration-150 select-none"
    >
      <div className="flex items-center justify-between pb-2 border-b border-[#21262D]">
        <span className="text-xs font-semibold text-gray-200">Customize shortcut</span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
          title="Cancel (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="my-3 flex flex-col items-center justify-center py-2.5 px-2 bg-[#0D1117] border border-[#21262D] rounded-lg min-h-[58px]">
        {isSaving ? (
          <span className="text-xs text-sky-400 animate-pulse font-mono">
            Registering shortcut...
          </span>
        ) : pressedKeys.length > 0 ? (
          <ShortcutKeyCaps shortcut={pressedKeys} size="md" />
        ) : (
          <span className="text-xs text-sky-400 animate-pulse font-mono flex items-center gap-1.5">
            Press your shortcut...
          </span>
        )}
      </div>

      {displayError ? (
        <div className="text-[11px] text-red-400 flex items-start gap-1.5 mb-2 leading-tight">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{displayError}</span>
        </div>
      ) : (
        <div className="text-[11px] text-gray-400 text-center mb-2">
          e.g. <span className="text-gray-300 font-mono">Ctrl + Space</span> or <span className="text-gray-300 font-mono">Alt + Shift + K</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-[#21262D] text-[10px] text-gray-500">
        <span>Current: <span className="font-mono text-gray-400">{currentShortcut}</span></span>
        <span className="font-mono">Esc to cancel</span>
      </div>
    </div>
  );
};
