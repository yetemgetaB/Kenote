import React, { useCallback, useRef, useEffect, useState } from "react";
import { NodeViewContent, NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { ChevronDownIcon, ChevronRightIcon } from "./Icons";

export const SectionComponent: React.FC<NodeViewProps> = ({
  editor,
  node,
  updateAttributes,
  getPos,
}) => {
  const title = typeof node.attrs.title === "string" ? node.attrs.title : "";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hasAutoFocused, setHasAutoFocused] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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
      setIsCollapsed((prev) => !prev);
    },
    []
  );

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();

        if (isCollapsed) {
          setIsCollapsed(false);
        }

        if (editor && !editor.isDestroyed && typeof getPos === "function") {
          try {
            const pos = getPos();
            if (typeof pos === "number") {
              // Focus directly inside the first textblock of the section body
              editor.commands.focus(pos + 1);
            }
          } catch (err) {
            console.warn("Could not focus section body on Enter:", err);
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        (e.target as HTMLElement)?.blur();
        editor?.commands.focus();
      }
    },
    [editor, getPos, isCollapsed]
  );

  return (
    <NodeViewWrapper
      className={`kenote-section-wrapper relative my-3.5 rounded-lg border border-[#262D38] bg-[#181D24]/75 overflow-hidden transition-colors shadow-sm group/section ${
        isCollapsed ? "kenote-section-collapsed" : "kenote-section-expanded"
      }`}
      data-type="section"
      data-collapsed={isCollapsed ? "true" : "false"}
    >
      {/* Section Header */}
      <div
        className={`kenote-section-header flex items-center px-3 py-2 bg-[#1C222B] text-xs select-none transition-colors ${
          isCollapsed ? "border-b-0" : "border-b border-[#262D38]"
        }`}
      >
        <button
          type="button"
          contentEditable={false}
          onClick={handleToggleCollapse}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={isCollapsed ? "Expand section" : "Collapse section"}
          title={isCollapsed ? "Expand section" : "Collapse section"}
          className="mr-2 p-1 -ml-1 text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#2A3241] rounded transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#3B82F6] flex items-center justify-center cursor-pointer shrink-0"
        >
          {isCollapsed ? (
            <ChevronRightIcon size={14} className="text-[#94A3B8]" />
          ) : (
            <ChevronDownIcon size={14} className="text-[#94A3B8]" />
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

      {/* Section Content Hole */}
      <NodeViewContent
        className={`kenote-section-content p-3.5 text-[#D8E1E8] min-h-[2rem] ${
          isCollapsed ? "hidden" : ""
        }`}
        style={{ display: isCollapsed ? "none" : undefined }}
      />
    </NodeViewWrapper>
  );
};
