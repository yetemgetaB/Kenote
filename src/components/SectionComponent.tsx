import React, { useCallback } from "react";
import { NodeViewContent, NodeViewWrapper, NodeViewProps } from "@tiptap/react";

export const SectionComponent: React.FC<NodeViewProps> = ({
  editor,
  node,
  updateAttributes,
  getPos,
}) => {
  const title = typeof node.attrs.title === "string" ? node.attrs.title : "";

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAttributes({ title: e.target.value });
    },
    [updateAttributes]
  );

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();

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
    [editor, getPos]
  );

  return (
    <NodeViewWrapper
      className="kenote-section-wrapper relative my-3.5 rounded-lg border border-[#262D38] bg-[#181D24]/75 overflow-hidden transition-colors shadow-sm group/section"
      data-type="section"
    >
      {/* Section Header */}
      <div className="kenote-section-header flex items-center px-3.5 py-2 bg-[#1C222B] border-b border-[#262D38] text-xs select-none">
        <input
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
      <NodeViewContent className="kenote-section-content p-3.5 text-[#D8E1E8] min-h-[2rem]" />
    </NodeViewWrapper>
  );
};
