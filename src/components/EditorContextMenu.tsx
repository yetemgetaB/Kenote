import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";

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
    const menuWidth = menuEl?.offsetWidth || 190;
    const menuHeight = menuEl?.offsetHeight || 220;

    const clampedX = Math.max(padding, Math.min(x, window.innerWidth - menuWidth - padding));
    const clampedY = Math.max(padding, Math.min(y, window.innerHeight - menuHeight - padding));

    setPosition({ left: clampedX, top: clampedY });
  }, [isOpen, x, y]);

  // Handle dismissal: Outside click, Escape key, and window blur / resize / scroll
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

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  const modKey = isMac ? "⌘" : "Ctrl+";

  const { selection } = editor.state;
  const hasSelection = !selection.empty;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Editor Context Menu"
      style={{
        position: "fixed",
        left: `${position.left}px`,
        top: `${position.top}px`,
        zIndex: 9999,
      }}
      className="w-48 bg-[#1E242E] border border-[#2B3340] rounded-lg shadow-xl shadow-black/40 p-1 select-none animate-in fade-in zoom-in-95 duration-75 text-xs text-[#D8E1E8]"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Action list placeholder / items for foundation */}
      <button
        role="menuitem"
        disabled={!hasSelection}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onClose();
          document.execCommand("cut");
        }}
        className={`w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between transition-colors ${
          hasSelection
            ? "hover:bg-[#262E3B] hover:text-white cursor-pointer"
            : "text-[#64748B] opacity-50 cursor-not-allowed"
        }`}
      >
        <span>Cut</span>
        <span className="text-[10px] text-[#64748B] font-mono">{modKey}X</span>
      </button>

      <button
        role="menuitem"
        disabled={!hasSelection}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onClose();
          document.execCommand("copy");
        }}
        className={`w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between transition-colors ${
          hasSelection
            ? "hover:bg-[#262E3B] hover:text-white cursor-pointer"
            : "text-[#64748B] opacity-50 cursor-not-allowed"
        }`}
      >
        <span>Copy</span>
        <span className="text-[10px] text-[#64748B] font-mono">{modKey}C</span>
      </button>

      <button
        role="menuitem"
        onMouseDown={(e) => e.preventDefault()}
        onClick={async () => {
          onClose();
          try {
            const text = await navigator.clipboard.readText();
            if (text) {
              editor.commands.insertContent(text);
            }
          } catch {
            document.execCommand("paste");
          }
        }}
        className="w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between hover:bg-[#262E3B] hover:text-white cursor-pointer transition-colors"
      >
        <span>Paste</span>
        <span className="text-[10px] text-[#64748B] font-mono">{modKey}V</span>
      </button>

      <div className="h-px bg-[#262D38] my-1" />

      <button
        role="menuitem"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onClose();
          editor.chain().focus().toggleBold().run();
        }}
        className="w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between hover:bg-[#262E3B] hover:text-white cursor-pointer transition-colors"
      >
        <span>Bold</span>
        <span className="text-[10px] text-[#64748B] font-mono">{modKey}B</span>
      </button>

      <button
        role="menuitem"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onClose();
          editor.chain().focus().toggleItalic().run();
        }}
        className="w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between hover:bg-[#262E3B] hover:text-white cursor-pointer transition-colors"
      >
        <span>Italic</span>
        <span className="text-[10px] text-[#64748B] font-mono">{modKey}I</span>
      </button>

      <button
        role="menuitem"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onClose();
          editor.chain().focus().toggleUnderline().run();
        }}
        className="w-full px-2.5 py-1.5 text-left rounded-md flex items-center justify-between hover:bg-[#262E3B] hover:text-white cursor-pointer transition-colors"
      >
        <span>Underline</span>
        <span className="text-[10px] text-[#64748B] font-mono">{modKey}U</span>
      </button>
    </div>
  );
};
