import React, { useState, useEffect, useRef, useCallback } from "react";
import { Editor as TiptapEditor } from "@tiptap/react";
import {
  SectionIcon,
  CodeBlockIcon,
  QuoteIcon,
  CheckIcon,
  ListIcon,
} from "./Icons";

export interface SlashMenuItem {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  icon: React.ReactNode;
  shortcut?: string;
  hasArgument?: boolean;
  execute: (editor: TiptapEditor, argument?: string) => void;
}

interface SlashMenuProps {
  editor: TiptapEditor | null;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [coords, setCoords] = useState<{ left: number; top: number; bottom: number } | null>(null);
  const [argumentMode, setArgumentMode] = useState<SlashMenuItem | null>(null);
  const [argumentValue, setArgumentValue] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);
  const argumentInputRef = useRef<HTMLInputElement>(null);
  const isDismissedRef = useRef(false);

  const items: SlashMenuItem[] = [
    {
      id: "stack",
      title: "Stack / Section",
      description: "Collapsible container block for organized notes",
      keywords: ["stack", "section", "collapsible", "toggle", "accordion", "container"],
      shortcut: "Ctrl+Shift+S",
      hasArgument: true,
      icon: <SectionIcon size={16} className="text-[#38BDF8]" />,
      execute: (ed, title) => {
        ed.commands.insertSection({ title: title?.trim() || "Untitled Section" });
      },
    },
    {
      id: "h1",
      title: "Heading 1",
      description: "Large top-level section heading",
      keywords: ["heading", "h1", "title", "large"],
      shortcut: "#",
      icon: (
        <span className="text-xs font-bold font-mono text-[#A78BFA] px-1 py-0.5 rounded bg-[#A78BFA]/10">
          H1
        </span>
      ),
      execute: (ed) => {
        ed.chain().focus().setHeading({ level: 1 }).run();
      },
    },
    {
      id: "h2",
      title: "Heading 2",
      description: "Medium subsection heading",
      keywords: ["heading", "h2", "subtitle", "medium"],
      shortcut: "##",
      icon: (
        <span className="text-xs font-bold font-mono text-[#818CF8] px-1 py-0.5 rounded bg-[#818CF8]/10">
          H2
        </span>
      ),
      execute: (ed) => {
        ed.chain().focus().setHeading({ level: 2 }).run();
      },
    },
    {
      id: "h3",
      title: "Heading 3",
      description: "Small subsection heading",
      keywords: ["heading", "h3", "small"],
      shortcut: "###",
      icon: (
        <span className="text-xs font-bold font-mono text-[#60A5FA] px-1 py-0.5 rounded bg-[#60A5FA]/10">
          H3
        </span>
      ),
      execute: (ed) => {
        ed.chain().focus().setHeading({ level: 3 }).run();
      },
    },
    {
      id: "task",
      title: "Task List",
      description: "Interactive checklist with checkable items",
      keywords: ["todo", "task", "checklist", "check", "box"],
      shortcut: "[]",
      icon: <CheckIcon size={16} className="text-[#34D399]" />,
      execute: (ed) => {
        ed.chain().focus().toggleTaskList().run();
      },
    },
    {
      id: "bullet_list",
      title: "Bullet List",
      description: "Simple bulleted list for quick notes",
      keywords: ["list", "bullet", "unordered"],
      shortcut: "-",
      icon: <ListIcon size={16} className="text-[#FBBF24]" />,
      execute: (ed) => {
        ed.chain().focus().toggleBulletList().run();
      },
    },
    {
      id: "code_block",
      title: "Code Block",
      description: "Syntax-highlighted code block",
      keywords: ["code", "snippet", "pre", "highlight", "script"],
      shortcut: "```",
      icon: <CodeBlockIcon size={16} className="text-[#F472B6]" />,
      execute: (ed) => {
        ed.chain().focus().toggleCodeBlock().run();
      },
    },
    {
      id: "quote",
      title: "Quote",
      description: "Blockquote callout for quotes or excerpts",
      keywords: ["quote", "blockquote", "callout"],
      shortcut: ">",
      icon: <QuoteIcon size={16} className="text-[#94A3B8]" />,
      execute: (ed) => {
        ed.chain().focus().toggleBlockquote().run();
      },
    },
    {
      id: "divider",
      title: "Divider",
      description: "Horizontal dividing line",
      keywords: ["divider", "hr", "line", "separator"],
      shortcut: "---",
      icon: (
        <div className="w-4 h-[2px] bg-[#94A3B8] rounded" />
      ),
      execute: (ed) => {
        ed.chain().focus().setHorizontalRule().run();
      },
    },
  ];

  // Filter items matching query
  const filteredItems = items.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

  // Clamp selection index
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus argument input when entering argument pill mode
  useEffect(() => {
    if (argumentMode) {
      setTimeout(() => {
        argumentInputRef.current?.focus();
      }, 50);
    }
  }, [argumentMode]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setArgumentMode(null);
    setArgumentValue("");
    isDismissedRef.current = true;
  }, []);

  // Execute selected item
  const executeItem = useCallback(
    (item: SlashMenuItem, arg?: string) => {
      if (!editor || editor.isDestroyed) return;

      const { from } = editor.state.selection;
      const $from = editor.state.doc.resolve(from);
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, null, "\ufffc");
      const match = textBefore.match(/\/([a-zA-Z0-9_-]*)$/);

      if (match) {
        const slashStart = from - match[0].length;
        // Delete the slash trigger text
        editor.chain().focus().deleteRange({ from: slashStart, to: from }).run();
      }

      item.execute(editor, arg);
      closeMenu();
    },
    [editor, closeMenu]
  );

  // Enter argument pill mode
  const enterArgumentMode = useCallback((item: SlashMenuItem) => {
    setArgumentMode(item);
    setArgumentValue("");
  }, []);

  // Listen to editor updates to detect slash command trigger
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const handleUpdate = () => {
      if (argumentMode) return;

      const { selection } = editor.state;
      if (!selection.empty) {
        if (isOpen) closeMenu();
        return;
      }

      const { from } = selection;
      const $from = editor.state.doc.resolve(from);
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, null, "\ufffc");

      // Match '/' at the beginning of a block
      const match = textBefore.match(/^\/([a-zA-Z0-9_-]*)$/);

      if (match) {
        if (isDismissedRef.current) return;

        const q = match[1];
        setQuery(q);

        try {
          const coordsAtCursor = editor.view.coordsAtPos(from);
          setCoords(coordsAtCursor);
          setIsOpen(true);
        } catch {
          // Ignore layout race
        }
      } else {
        isDismissedRef.current = false;
        if (isOpen) {
          closeMenu();
        }
      }
    };

    editor.on("update", handleUpdate);
    editor.on("selectionUpdate", handleUpdate);

    return () => {
      editor.off("update", handleUpdate);
      editor.off("selectionUpdate", handleUpdate);
    };
  }, [editor, isOpen, argumentMode, closeMenu]);

  // Handle keyboard events when Slash Menu is active
  useEffect(() => {
    if (!editor || editor.isDestroyed || (!isOpen && !argumentMode)) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (argumentMode) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeMenu();
          editor.commands.focus();
        } else if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          executeItem(argumentMode, argumentValue);
        }
        return;
      }

      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + (filteredItems.length || 1)) % (filteredItems.length || 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          executeItem(selected);
        }
      } else if (e.key === " " || e.key === "Tab") {
        const selected = filteredItems[selectedIndex];
        if (selected && selected.hasArgument) {
          e.preventDefault();
          e.stopPropagation();
          enterArgumentMode(selected);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [editor, isOpen, argumentMode, filteredItems, selectedIndex, argumentValue, executeItem, enterArgumentMode, closeMenu]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen && !argumentMode) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, argumentMode, closeMenu]);

  if (!isOpen && !argumentMode) {
    return null;
  }

  // Calculate position (fixed relative to viewport coords)
  const left = coords ? Math.max(16, Math.min(coords.left, window.innerWidth - 300)) : 100;
  const isNearBottom = coords ? coords.bottom + 280 > window.innerHeight : false;
  const top = coords ? (isNearBottom ? coords.top - 260 : coords.bottom + 6) : 100;

  // Render Argument Pill mode
  if (argumentMode) {
    return (
      <div
        ref={menuRef}
        style={{ left: `${left}px`, top: `${coords ? coords.bottom + 6 : 100}px` }}
        className="fixed z-50 flex items-center gap-1.5 p-1.5 bg-[#1C222B] border border-[#3B82F6] rounded-lg shadow-xl shadow-black/40 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Command Pill Tag */}
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#2A3241] text-[#38BDF8] text-xs font-semibold select-none shrink-0 border border-[#38BDF8]/20">
          <SectionIcon size={14} className="text-[#38BDF8]" />
          <span>Stack</span>
        </div>

        {/* Argument Input */}
        <input
          ref={argumentInputRef}
          type="text"
          value={argumentValue}
          onChange={(e) => setArgumentValue(e.target.value)}
          placeholder="Stack title (optional)..."
          className="bg-transparent text-xs text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none px-1.5 py-1 w-48 border-none"
        />

        {/* Enter Hint Pill */}
        <button
          type="button"
          onClick={() => executeItem(argumentMode, argumentValue)}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#3B82F6]/20 text-[#60A5FA] hover:bg-[#3B82F6]/30 text-[10px] font-mono cursor-pointer transition-colors border border-[#3B82F6]/30"
          title="Press Enter to create stack"
        >
          <span>↵ Enter</span>
        </button>
      </div>
    );
  }

  // Render Slash Menu List
  return (
    <div
      ref={menuRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      className="fixed z-50 w-72 max-h-64 overflow-y-auto bg-[#1C222B]/95 border border-[#2E3748] rounded-xl shadow-2xl shadow-black/50 backdrop-blur-md p-1.5 custom-scrollbar animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase text-[#64748B] border-b border-[#262D38]/60 mb-1 flex items-center justify-between">
        <span>Blocks</span>
        {query && <span className="font-mono text-[#94A3B8]">/{query}</span>}
      </div>

      {filteredItems.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-[#64748B]">
          No matching blocks
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {filteredItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => {
                  if (item.hasArgument) {
                    enterArgumentMode(item);
                  } else {
                    executeItem(item);
                  }
                }}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer group ${
                  isSelected
                    ? "bg-[#2A3241] text-[#F1F5F9]"
                    : "text-[#94A3B8] hover:bg-[#232936] hover:text-[#F1F5F9]"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                    isSelected
                      ? "bg-[#1E2530] border-[#3B82F6]/40"
                      : "bg-[#181D24] border-[#2A3241]"
                  }`}
                >
                  {item.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium truncate">
                      {item.title}
                    </span>
                    {item.hasArgument ? (
                      <span className="text-[10px] font-mono text-[#38BDF8]/80 bg-[#38BDF8]/10 px-1 py-0.2 rounded border border-[#38BDF8]/20">
                        Space for title
                      </span>
                    ) : item.shortcut ? (
                      <span className="text-[10px] font-mono text-[#64748B]">
                        {item.shortcut}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-[#64748B] truncate mt-0.5">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
