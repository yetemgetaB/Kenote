import React, { useCallback, useRef, useEffect, useState } from "react";
import { NodeViewContent, NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { Selection } from "@tiptap/pm/state";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  TrashIcon,
  MoreHorizontalIcon,
  CopyIcon,
  CodeBlockIcon,
  FileTextIcon,
  UnwrapIcon,
} from "./Icons";

export type SectionColor = "default" | "blue" | "emerald" | "amber" | "purple" | "rose";

export const SECTION_COLORS: {
  id: SectionColor;
  label: string;
  borderLeft: string;
  bgTint: string;
  chevronColor: string;
  dotBg: string;
}[] = [
  { id: "default", label: "Default", borderLeft: "border-l-[#333C4D]", bgTint: "bg-[#1C222B]", chevronColor: "text-[#94A3B8]", dotBg: "bg-[#475569]" },
  { id: "blue", label: "Blue", borderLeft: "border-l-[#38BDF8]", bgTint: "bg-[#1C222B] bg-gradient-to-r from-[#38BDF8]/[0.08] to-transparent", chevronColor: "text-[#38BDF8]", dotBg: "bg-[#38BDF8]" },
  { id: "emerald", label: "Emerald", borderLeft: "border-l-[#34D399]", bgTint: "bg-[#1C222B] bg-gradient-to-r from-[#34D399]/[0.08] to-transparent", chevronColor: "text-[#34D399]", dotBg: "bg-[#34D399]" },
  { id: "amber", label: "Amber", borderLeft: "border-l-[#FBBF24]", bgTint: "bg-[#1C222B] bg-gradient-to-r from-[#FBBF24]/[0.08] to-transparent", chevronColor: "text-[#FBBF24]", dotBg: "bg-[#FBBF24]" },
  { id: "purple", label: "Purple", borderLeft: "border-l-[#A78BFA]", bgTint: "bg-[#1C222B] bg-gradient-to-r from-[#A78BFA]/[0.08] to-transparent", chevronColor: "text-[#A78BFA]", dotBg: "bg-[#A78BFA]" },
  { id: "rose", label: "Rose", borderLeft: "border-l-[#F87171]", bgTint: "bg-[#1C222B] bg-gradient-to-r from-[#F87171]/[0.08] to-transparent", chevronColor: "text-[#F87171]", dotBg: "bg-[#F87171]" },
];

export const SectionComponent: React.FC<NodeViewProps> = ({
  editor,
  node,
  updateAttributes,
  deleteNode,
  getPos,
}) => {
  const title = typeof node.attrs.title === "string" ? node.attrs.title : "";
  const isCollapsed = Boolean(node.attrs.isCollapsed);
  const currentColorId: SectionColor = (node.attrs.color as SectionColor) || "default";
  const currentColor = SECTION_COLORS.find((c) => c.id === currentColorId) || SECTION_COLORS[0];

  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [hasAutoFocused, setHasAutoFocused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (node.attrs._autoFocus && !hasAutoFocused) {
      setHasAutoFocused(true);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      });
    }
  }, [node.attrs._autoFocus, hasAutoFocused]);

  // Click outside and escape handler for options menu
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAttributes({ title: e.target.value });
    },
    [updateAttributes]
  );

  const handleToggleCollapse = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      updateAttributes({ isCollapsed: !isCollapsed });
    },
    [isCollapsed, updateAttributes]
  );

  const handleHeaderDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement)?.tagName?.toLowerCase() === "input" || menuRef.current?.contains(e.target as Node)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      updateAttributes({ isCollapsed: !isCollapsed });
    },
    [isCollapsed, updateAttributes]
  );

  const handleDelete = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      setIsMenuOpen(false);
      if (typeof deleteNode === "function") {
        deleteNode();
      } else if (editor && typeof getPos === "function") {
        try {
          const pos = getPos();
          if (typeof pos === "number") {
            editor.commands.deleteRange({ from: pos, to: pos + node.nodeSize });
          }
        } catch (err) {
          console.warn("Could not delete section:", err);
        }
      }
      editor?.commands.focus();
    },
    [deleteNode, editor, getPos, node.nodeSize]
  );

  const handleDuplicate = useCallback(() => {
    if (!editor || typeof getPos !== "function") return;
    try {
      const pos = getPos();
      if (typeof pos === "number") {
        const afterPos = pos + node.nodeSize;
        editor.commands.insertContentAt(afterPos, node.toJSON());
      }
    } catch (err) {
      console.warn("Could not duplicate section:", err);
    }
    setIsMenuOpen(false);
  }, [editor, getPos, node]);

  const handleCopyMarkdown = useCallback(async () => {
    if (!editor || typeof getPos !== "function") return;
    try {
      const markdownStorage = (editor.storage as any)?.markdown;
      let md = "";
      if (markdownStorage?.serializer) {
        md = markdownStorage.serializer.serialize(node);
      } else {
        const innerText = node.textContent;
        md = `::: kenote-section title="${title}"\n${innerText}\n:::`;
      }
      await navigator.clipboard.writeText(md.trim());
    } catch (err) {
      console.warn("Could not copy section markdown:", err);
    }
    setIsMenuOpen(false);
  }, [editor, getPos, node, title]);

  const handleCopyPlainText = useCallback(async () => {
    try {
      const headerText = title ? `${title}\n\n` : "";
      const plainText = `${headerText}${node.textContent}`.trim();
      await navigator.clipboard.writeText(plainText);
    } catch (err) {
      console.warn("Could not copy plain text:", err);
    }
    setIsMenuOpen(false);
  }, [node, title]);

  const handleUnwrap = useCallback(() => {
    if (!editor || typeof getPos !== "function") return;
    try {
      const pos = getPos();
      if (typeof pos === "number") {
        const tr = editor.state.tr;
        const nodesToInsert: any[] = [];
        const hasCustomTitle = title.trim() !== "" && title.trim() !== "Untitled Section";

        if (hasCustomTitle && editor.state.schema.nodes.heading) {
          nodesToInsert.push(
            editor.state.schema.nodes.heading.create(
              { level: 3 },
              editor.state.schema.text(title.trim())
            )
          );
        }

        for (let i = 0; i < node.childCount; i++) {
          nodesToInsert.push(node.child(i));
        }

        if (nodesToInsert.length === 0 && editor.state.schema.nodes.paragraph) {
          nodesToInsert.push(editor.state.schema.nodes.paragraph.create());
        }

        tr.replaceWith(pos, pos + node.nodeSize, nodesToInsert);
        editor.view.dispatch(tr);
        editor.commands.focus(pos + 1);
      }
    } catch (err) {
      console.warn("Could not unwrap section:", err);
    }
    setIsMenuOpen(false);
  }, [editor, getPos, node, title]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();

        if (isCollapsed) {
          updateAttributes({ isCollapsed: false });
        }

        if (editor && !editor.isDestroyed && typeof getPos === "function") {
          try {
            const pos = getPos();
            if (typeof pos === "number") {
              editor.commands.focus(pos + 1);
            }
          } catch (err) {
            console.warn("Could not focus section body on Enter:", err);
          }
        }
      } else if (e.key === "Backspace" && title === "") {
        e.preventDefault();
        e.stopPropagation();
        handleDelete();
      } else if (e.key === "Escape") {
        e.preventDefault();
        (e.target as HTMLElement)?.blur();
        editor?.commands.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (isCollapsed) {
          updateAttributes({ isCollapsed: false });
        }
        if (editor && !editor.isDestroyed && typeof getPos === "function") {
          try {
            const pos = getPos();
            if (typeof pos === "number") {
              editor.commands.focus(pos + 1);
            }
          } catch (err) {
            console.warn("Could not focus section body on ArrowDown:", err);
          }
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (editor && !editor.isDestroyed && typeof getPos === "function") {
          try {
            const pos = getPos();
            if (typeof pos === "number") {
              const $resolved = editor.state.doc.resolve(pos);
              const parentDepth = $resolved.depth;
              const isAtParentStart = pos <= $resolved.start(parentDepth);

              if (isAtParentStart) {
                const paragraphType = editor.state.schema.nodes.paragraph;
                if (paragraphType) {
                  editor.chain().insertContentAt(pos, { type: "paragraph" }).focus(pos + 1).run();
                }
              } else {
                const sel = Selection.findFrom($resolved, -1);
                if (sel) {
                  editor.view.dispatch(editor.state.tr.setSelection(sel));
                  editor.view.focus();
                }
              }
            }
          } catch (err) {
            console.warn("Could not navigate above section on ArrowUp:", err);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (isCollapsed) {
          updateAttributes({ isCollapsed: false });
        }
        if (editor && !editor.isDestroyed && typeof getPos === "function") {
          try {
            const pos = getPos();
            if (typeof pos === "number") {
              editor.commands.focus(pos + 1);
              editor.commands.insertSection();
            }
          } catch (err) {
            console.warn("Could not insert nested section from title:", err);
          }
        }
      }
    },
    [editor, getPos, handleDelete, isCollapsed, title]
  );

  return (
    <NodeViewWrapper
      className={`kenote-section-wrapper relative my-3.5 rounded-lg border border-[#262D38] ${currentColor.borderLeft} border-l-[3.5px] bg-[#181D24]/75 overflow-visible transition-all duration-150 shadow-sm group/section ${
        isCollapsed ? "kenote-section-collapsed" : "kenote-section-expanded"
      }`}
      data-type="section"
      data-collapsed={isCollapsed ? "true" : "false"}
      data-color={currentColorId}
    >
      {/* Section Header */}
      <div
        onDoubleClick={handleHeaderDoubleClick}
        title="Double-click to collapse or expand"
        className={`kenote-section-header flex items-center justify-between px-3 py-2 ${currentColor.bgTint} text-xs select-none transition-colors cursor-pointer rounded-t-lg ${
          isCollapsed ? "border-b-0 rounded-b-lg" : "border-b border-[#262D38]"
        }`}
      >
        <div className="flex items-center flex-1 mr-2 min-w-0">
          <button
            type="button"
            contentEditable={false}
            onClick={handleToggleCollapse}
            onMouseDown={(e) => e.preventDefault()}
            aria-label={isCollapsed ? "Expand section" : "Collapse section"}
            title={isCollapsed ? "Expand section" : "Collapse section"}
            className={`mr-2 p-1 -ml-1 ${currentColor.chevronColor} hover:bg-[#2A3241] rounded transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#3B82F6] flex items-center justify-center cursor-pointer shrink-0`}
          >
            {isCollapsed ? (
              <ChevronRightIcon size={14} className={currentColor.chevronColor} />
            ) : (
              <ChevronDownIcon size={14} className={currentColor.chevronColor} />
            )}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            placeholder="Section title..."
            className="w-full bg-transparent text-[13px] font-semibold text-[#F1F5F9] placeholder:text-[#64748B] placeholder:font-normal focus:outline-none border-none p-0 tracking-wide"
            aria-label="Section title"
          />
        </div>

        {/* More Options Dropdown Menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            contentEditable={false}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMenuOpen((prev) => !prev);
            }}
            onMouseDown={(e) => e.preventDefault()}
            aria-label="Section options"
            title="Section options"
            className="p-1 -mr-1 text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#2A3241] rounded transition-all opacity-0 group-hover/section:opacity-100 focus:opacity-100 focus:outline-none flex items-center justify-center cursor-pointer"
          >
            <MoreHorizontalIcon size={14} />
          </button>

          {isMenuOpen && (
            <div
              contentEditable={false}
              className="absolute right-0 top-full mt-1 w-52 bg-[#1E242E] border border-[#2B3340] rounded-lg shadow-2xl py-1 text-xs select-none z-50 animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Accent Color Swatches */}
              <div className="px-2.5 py-1.5 flex items-center justify-between gap-1 border-b border-[#2B3340]/70 mb-1">
                {SECTION_COLORS.map((c) => {
                  const isSelected = currentColorId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      onClick={() => updateAttributes({ color: c.id })}
                      className={`w-4 h-4 rounded-full ${c.dotBg} transition-transform flex items-center justify-center ${
                        isSelected ? "ring-2 ring-white scale-110" : "hover:scale-125 opacity-70 hover:opacity-100"
                      }`}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleDuplicate}
                className="w-full px-2.5 py-1.5 text-left text-[#D8E1E8] hover:bg-[#2A3240] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <CopyIcon size={13} className="text-[#94A3B8]" />
                <span>Duplicate Stack</span>
              </button>

              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="w-full px-2.5 py-1.5 text-left text-[#D8E1E8] hover:bg-[#2A3240] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <CodeBlockIcon size={13} className="text-[#94A3B8]" />
                <span>Copy as Markdown</span>
              </button>

              <button
                type="button"
                onClick={handleCopyPlainText}
                className="w-full px-2.5 py-1.5 text-left text-[#D8E1E8] hover:bg-[#2A3240] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FileTextIcon size={13} className="text-[#94A3B8]" />
                <span>Copy as Plain Text</span>
              </button>

              <button
                type="button"
                onClick={handleUnwrap}
                className="w-full px-2.5 py-1.5 text-left text-[#D8E1E8] hover:bg-[#2A3240] hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <UnwrapIcon size={13} className="text-[#94A3B8]" />
                <span>Unwrap Stack</span>
              </button>

              <div className="my-1 border-t border-[#2B3340]/70" />

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  editor.commands.collapseAllSections();
                }}
                className="w-full px-2.5 py-1.5 text-left text-[#D8E1E8] hover:bg-[#2A3240] hover:text-white flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ChevronRightIcon size={13} className="text-[#94A3B8]" />
                  <span>Collapse All Stacks</span>
                </div>
                <span className="text-[10px] text-[#64748B] font-mono">Ctrl+Alt+[</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  editor.commands.expandAllSections();
                }}
                className="w-full px-2.5 py-1.5 text-left text-[#D8E1E8] hover:bg-[#2A3240] hover:text-white flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ChevronDownIcon size={13} className="text-[#94A3B8]" />
                  <span>Expand All Stacks</span>
                </div>
                <span className="text-[10px] text-[#64748B] font-mono">Ctrl+Alt+]</span>
              </button>

              <div className="my-1 border-t border-[#2B3340]/70" />

              <button
                type="button"
                onClick={handleDelete}
                className="w-full px-2.5 py-1.5 text-left text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <TrashIcon size={13} className="text-red-400" />
                <span>Delete Stack</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section Content Hole */}
      <div
        className={`kenote-section-body px-4 py-3 bg-[#13171D]/50 text-[#D8E1E8] transition-all duration-150 ${
          isCollapsed ? "hidden" : "block"
        }`}
      >
        <NodeViewContent className="kenote-section-content min-h-[1.5rem] focus:outline-none" />
      </div>
    </NodeViewWrapper>
  );
};
