import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import {
  CutIcon,
  CopyIcon,
  PasteIcon,
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ClearFormattingIcon,
} from "./Icons";
import {
  toggleSmartBold,
  toggleSmartItalic,
  toggleSmartUnderline,
  clearFormatting,
} from "../utils/formatting";

export interface EditorContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  onClose: () => void;
  editor: TiptapEditor | null;
}

export const EditorContextMenu: React.FC<EditorContextMenuProps> = ({
  isOpen,
  x,
  y,
  onClose,
  editor,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: x, top: y });

  // Clamp position to viewport bounds after rendering
  useLayoutEffect(() => {
    if (!isOpen) return;

    const menuEl = menuRef.current;
    const padding = 8;
    const menuWidth = menuEl?.offsetWidth || 208;
    const menuHeight = menuEl?.offsetHeight || 260;

    const clampedX = Math.max(padding, Math.min(x, window.innerWidth - menuWidth - padding));
    const clampedY = Math.max(padding, Math.min(y, window.innerHeight - menuHeight - padding));

    setPosition({ left: clampedX, top: clampedY });
  }, [isOpen, x, y]);

  // Handle dismissal & global keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        editor?.commands.focus();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    const handleResize = () => {
      onClose();
    };

    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, onClose, editor]);

  if (!isOpen || !editor) return null;

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  const modKey = isMac ? "⌘" : "Ctrl+";

  const { selection } = editor.state;
  const hasSelection = !selection.empty;

  // Arrow key navigation inside context menu
  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not([disabled])') || []
    );
    if (!items.length) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[nextIndex]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prevIndex]?.focus();
    }
  };

  // Actions
  const handleCut = async () => {
    onClose();
    if (!hasSelection) return;
    try {
      const selectedText = editor.state.doc.textBetween(selection.from, selection.to, "\n");
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selectedText);
        editor.chain().focus().deleteSelection().run();
      } else {
        editor.commands.focus();
        document.execCommand("cut");
      }
    } catch {
      editor.commands.focus();
      document.execCommand("cut");
    }
  };

  const handleCopy = async () => {
    onClose();
    if (!hasSelection) return;
    try {
      const selectedText = editor.state.doc.textBetween(selection.from, selection.to, "\n");
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selectedText);
        editor.commands.focus();
      } else {
        editor.commands.focus();
        document.execCommand("copy");
      }
    } catch {
      editor.commands.focus();
      document.execCommand("copy");
    }
  };

  const handlePaste = async () => {
    onClose();
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          editor.chain().focus().insertContent(text).run();
          return;
        }
      }
      editor.commands.focus();
      document.execCommand("paste");
    } catch {
      editor.commands.focus();
      document.execCommand("paste");
    }
  };

  const handleBold = () => {
    onClose();
    toggleSmartBold(editor);
    editor.commands.focus();
  };

  const handleItalic = () => {
    onClose();
    toggleSmartItalic(editor);
    editor.commands.focus();
  };

  const handleUnderline = () => {
    onClose();
    toggleSmartUnderline(editor);
    editor.commands.focus();
  };

  const handleClearFormatting = () => {
    onClose();
    clearFormatting(editor);
    editor.commands.focus();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      aria-label="Editor Context Menu"
      onKeyDown={handleMenuKeyDown}
      style={{
        position: "fixed",
        left: `${position.left}px`,
        top: `${position.top}px`,
        zIndex: 9999,
      }}
      className="w-52 bg-[#1E242E] border border-[#2B3340] rounded-lg shadow-xl shadow-black/40 p-1 select-none animate-in fade-in zoom-in-95 duration-75 text-xs text-[#D8E1E8] focus:outline-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Clipboard Group */}
      <button
        role="menuitem"
        tabIndex={hasSelection ? 0 : -1}
        disabled={!hasSelection}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleCut}
        className={`w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between transition-colors focus:bg-[#262E3B] focus:text-white focus:outline-none ${
          hasSelection
            ? "hover:bg-[#262E3B] hover:text-white cursor-pointer"
            : "text-[#64748B] opacity-50 cursor-not-allowed pointer-events-none"
        }`}
      >
        <div className="flex items-center space-x-2">
          <CutIcon size={14} className="opacity-70" />
          <span>Cut</span>
        </div>
        <span className="text-[10px] text-[#64748B] font-mono">{modKey}X</span>
      </button>

      <button
        role="menuitem"
        tabIndex={hasSelection ? 0 : -1}
        disabled={!hasSelection}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleCopy}
        className={`w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between transition-colors focus:bg-[#262E3B] focus:text-white focus:outline-none ${
          hasSelection
            ? "hover:bg-[#262E3B] hover:text-white cursor-pointer"
            : "text-[#64748B] opacity-50 cursor-not-allowed pointer-events-none"
        }`}
      >
        <div className="flex items-center space-x-2">
          <CopyIcon size={14} className="opacity-70" />
          <span>Copy</span>
        </div>
        <span className="text-[10px] text-[#64748B] font-mono">{modKey}C</span>
      </button>

      <button
        role="menuitem"
        tabIndex={0}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handlePaste}
        className="w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between hover:bg-[#262E3B] hover:text-white cursor-pointer transition-colors focus:bg-[#262E3B] focus:text-white focus:outline-none"
      >
        <div className="flex items-center space-x-2">
          <PasteIcon size={14} className="opacity-70" />
          <span>Paste</span>
        </div>
        <span className="text-[10px] text-[#64748B] font-mono">{modKey}V</span>
      </button>

      {/* Separator */}
      <div className="h-px bg-[#262D38] my-1" />

      {/* Formatting Group */}
      <button
        role="menuitem"
        tabIndex={0}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleBold}
        className="w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between hover:bg-[#262E3B] hover:text-white cursor-pointer transition-colors focus:bg-[#262E3B] focus:text-white focus:outline-none"
      >
        <div className="flex items-center space-x-2">
          <BoldIcon size={14} className="opacity-70" />
          <span>Bold</span>
        </div>
        <span className="text-[10px] text-[#64748B] font-mono">{modKey}B</span>
      </button>

      <button
        role="menuitem"
        tabIndex={0}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleItalic}
        className="w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between hover:bg-[#262E3B] hover:text-white cursor-pointer transition-colors focus:bg-[#262E3B] focus:text-white focus:outline-none"
      >
        <div className="flex items-center space-x-2">
          <ItalicIcon size={14} className="opacity-70" />
          <span>Italic</span>
        </div>
        <span className="text-[10px] text-[#64748B] font-mono">{modKey}I</span>
      </button>

      <button
        role="menuitem"
        tabIndex={0}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleUnderline}
        className="w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between hover:bg-[#262E3B] hover:text-white cursor-pointer transition-colors focus:bg-[#262E3B] focus:text-white focus:outline-none"
      >
        <div className="flex items-center space-x-2">
          <UnderlineIcon size={14} className="opacity-70" />
          <span>Underline</span>
        </div>
        <span className="text-[10px] text-[#64748B] font-mono">{modKey}U</span>
      </button>

      <button
        role="menuitem"
        tabIndex={0}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleClearFormatting}
        className="w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between hover:bg-[#262E3B] hover:text-white cursor-pointer transition-colors focus:bg-[#262E3B] focus:text-white focus:outline-none"
      >
        <div className="flex items-center space-x-2">
          <ClearFormattingIcon size={14} className="opacity-70" />
          <span>Clear Formatting</span>
        </div>
      </button>
    </div>
  );
};
