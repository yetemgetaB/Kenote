import React, { useState, useEffect, useRef, useCallback } from "react";
import { Editor as TiptapEditor } from "@tiptap/react";
import {
  SectionIcon,
  CodeBlockIcon,
  QuoteIcon,
  CheckIcon,
  ListIcon,
  CalendarIcon,
  ClockIcon,
  LightbulbIcon,
  AlertTriangleIcon,
  InfoCircleIcon,
  ShieldAlertIcon,
  TableIcon,
  ImageIcon,
} from "./Icons";
import { api } from "../utils/tauriBridge";

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

  const menuRef = useRef<HTMLDivElement>(null);
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
      id: "ordered_list",
      title: "Numbered List",
      description: "Numbered list for ordered sequences or steps",
      keywords: ["number", "ordered", "1.", "list", "numbered", "sequence", "steps"],
      shortcut: "1.",
      icon: (
        <span className="text-xs font-bold font-mono text-[#FBBF24] px-1 py-0.5 rounded bg-[#FBBF24]/10">
          1.
        </span>
      ),
      execute: (ed) => {
        ed.chain().focus().toggleOrderedList().run();
      },
    },
    {
      id: "callout",
      title: "Callout / Note",
      description: "Highlighted note callout block",
      keywords: ["callout", "note", "alert", "info"],
      icon: <InfoCircleIcon size={16} className="text-[#38BDF8]" />,
      execute: (ed) => {
        ed.chain().focus().toggleBlockquote().insertContent("[!NOTE]\n").run();
      },
    },
    {
      id: "tip",
      title: "Callout: Tip",
      description: "Helpful tip or best practice highlight",
      keywords: ["tip", "hint", "callout", "best practice", "idea"],
      icon: <LightbulbIcon size={16} className="text-[#34D399]" />,
      execute: (ed) => {
        ed.chain().focus().toggleBlockquote().insertContent("[!TIP]\n").run();
      },
    },
    {
      id: "warning",
      title: "Callout: Warning",
      description: "Warning alert for critical notices",
      keywords: ["warning", "warn", "alert", "danger", "caution"],
      icon: <AlertTriangleIcon size={16} className="text-[#FBBF24]" />,
      execute: (ed) => {
        ed.chain().focus().toggleBlockquote().insertContent("[!WARNING]\n").run();
      },
    },
    {
      id: "important",
      title: "Callout: Important",
      description: "Crucial highlight or must-know information",
      keywords: ["important", "crucial", "alert", "key", "priority"],
      icon: <InfoCircleIcon size={16} className="text-[#A78BFA]" />,
      execute: (ed) => {
        ed.chain().focus().toggleBlockquote().insertContent("[!IMPORTANT]\n").run();
      },
    },
    {
      id: "caution",
      title: "Callout: Caution",
      description: "High-risk caution alert for potential pitfalls",
      keywords: ["caution", "danger", "risk", "hazard", "stop"],
      icon: <ShieldAlertIcon size={16} className="text-[#F87171]" />,
      execute: (ed) => {
        ed.chain().focus().toggleBlockquote().insertContent("[!CAUTION]\n").run();
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
      id: "table",
      title: "Table",
      description: "Insert a formatted 3x3 table with header row",
      keywords: ["table", "grid", "rows", "columns", "tabular", "data", "sheet"],
      shortcut: "/table",
      icon: <TableIcon size={16} className="text-[#38BDF8]" />,
      execute: (ed) => {
        ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      },
    },
    {
      id: "image",
      title: "Image Attachment",
      description: "Insert an image file from your computer",
      keywords: ["image", "picture", "photo", "img", "attachment", "upload", "file"],
      shortcut: "/image",
      icon: <ImageIcon size={16} className="text-[#38BDF8]" />,
      execute: (ed) => {
        api
          .selectImageFile()
          .then((file) => {
            if (!file) return;
            return api.saveImageAttachment(file).then((relPath) => {
              ed.chain()
                .focus()
                .insertContent({
                  type: "image",
                  attrs: {
                    src: relPath,
                    alt: file.name.replace(/\.[^/.]+$/, ""),
                  },
                })
                .run();
            });
          })
          .catch((err) => {
            console.error("Failed to insert image:", err);
          });
      },
    },
    {
      id: "quote",
      title: "Quote",
      description: "Blockquote callout for quotes or excerpts",
      keywords: ["quote", "blockquote"],
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
    {
      id: "today",
      title: "Today's Date",
      description: "Insert current date (e.g. October 23, 2026)",
      keywords: ["today", "date", "day", "calendar"],
      icon: <CalendarIcon size={16} className="text-[#38BDF8]" />,
      execute: (ed) => {
        const str = new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        ed.chain().focus().insertContent(str).run();
      },
    },
    {
      id: "date",
      title: "Date (DD/MM/YYYY)",
      description: "Insert current date in DD/MM/YYYY format",
      keywords: ["date", "calendar", "day", "dd/mm/yyyy", "short"],
      icon: <CalendarIcon size={16} className="text-[#818CF8]" />,
      execute: (ed) => {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();
        ed.chain().focus().insertContent(`${dd}/${mm}/${yyyy}`).run();
      },
    },
    {
      id: "time",
      title: "Current Time",
      description: "Insert current time (e.g. 7:15 PM)",
      keywords: ["time", "clock", "now"],
      icon: <ClockIcon size={16} className="text-[#34D399]" />,
      execute: (ed) => {
        const str = new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        ed.chain().focus().insertContent(str).run();
      },
    },
    {
      id: "now",
      title: "Date & Time Stamp",
      description: "Insert full timestamp (e.g. Oct 23, 2026, 7:15 PM)",
      keywords: ["now", "timestamp", "datetime", "date", "time"],
      icon: <ClockIcon size={16} className="text-[#F472B6]" />,
      execute: (ed) => {
        const now = new Date();
        const d = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const t = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        ed.chain().focus().insertContent(`${d}, ${t}`).run();
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

  const closeMenu = useCallback(() => {
    setIsOpen(false);
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
        editor.chain().focus().deleteRange({ from: slashStart, to: from }).run();
      }

      item.execute(editor, arg);
      closeMenu();
    },
    [editor, closeMenu]
  );

  // Transition into the inline line pill
  const enterArgumentMode = useCallback(() => {
    if (!editor || editor.isDestroyed) return;

    const { from } = editor.state.selection;
    const $from = editor.state.doc.resolve(from);
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, null, "\ufffc");
    const match = textBefore.match(/\/([a-zA-Z0-9_-]*)$/);

    closeMenu();

    if (match) {
      const slashStart = from - match[0].length;
      editor
        .chain()
        .focus()
        .deleteRange({ from: slashStart, to: from })
        .activateInlineStackPill({ pos: slashStart })
        .run();
    } else {
      editor.commands.activateInlineStackPill();
    }
  }, [editor, closeMenu]);

  // Listen to editor updates to detect slash command trigger
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const handleUpdate = () => {
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
          const slashStart = Math.max(0, from - match[0].length);
          const coordsAtCursor = editor.view.coordsAtPos(slashStart);
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
  }, [editor, isOpen, closeMenu]);

  // Handle keyboard events when Slash Menu is active
  useEffect(() => {
    if (!editor || editor.isDestroyed || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
          enterArgumentMode();
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
  }, [editor, isOpen, filteredItems, selectedIndex, executeItem, enterArgumentMode, closeMenu]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, closeMenu]);

  if (!isOpen) {
    return null;
  }

  // Calculate position (fixed relative to viewport coords)
  const left = coords ? Math.max(16, Math.min(coords.left, window.innerWidth - 300)) : 100;
  const isNearBottom = coords ? coords.bottom + 280 > window.innerHeight : false;

  const positionStyles: React.CSSProperties = coords
    ? isNearBottom
      ? {
          left: `${left}px`,
          bottom: `${Math.max(16, window.innerHeight - coords.top + 6)}px`,
        }
      : {
          left: `${left}px`,
          top: `${coords.bottom + 6}px`,
        }
    : { left: "100px", top: "100px" };

  // Render Slash Menu List
  return (
    <div
      ref={menuRef}
      style={positionStyles}
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
                    enterArgumentMode();
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
