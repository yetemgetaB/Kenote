import React, { useState, useRef, useEffect } from "react";
import { Editor as TiptapEditor } from "@tiptap/react";
import {
  CodeIcon,
  CodeBlockIcon,
  QuoteIcon,
  LinkIcon,
  ListIcon,
} from "./Icons";
import { toggleSmartBold, toggleSmartItalic, toggleSmartUnderline } from "./Editor";

interface BottomToolbarProps {
  editor: TiptapEditor | null;
  characterCount: number;
  saveStatus?: "saved" | "saving" | "error";
  onRetrySave?: () => void;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  editor,
  characterCount,
  saveStatus = "saved",
  onRetrySave,
}) => {
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showTextMenu, setShowTextMenu] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);

  const headingRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headingRef.current && !headingRef.current.contains(e.target as Node)) {
        setShowHeadingMenu(false);
      }
      if (textRef.current && !textRef.current.contains(e.target as Node)) {
        setShowTextMenu(false);
      }
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setShowListMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!editor) return null;

  const handleLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <footer className="h-10 w-full flex items-center justify-between px-4 bg-[#181D24]/95 border-t border-[#262D38] select-none text-xs text-gray-400 z-20 transition-colors">
      {/* Formatting Tools Left */}
      <div className="flex items-center space-x-1">
        {/* Headings Menu */}
        <div className="relative" ref={headingRef}>
          <button
            onClick={() => setShowHeadingMenu(!showHeadingMenu)}
            title="Headings"
            className={`px-2 py-1 rounded flex items-center space-x-0.5 hover:text-white hover:bg-[#262E3B] transition-colors focus:outline-none ${
              editor.isActive("heading") ? "text-[var(--accent-color,#0399F7)] bg-[var(--accent-muted,rgba(3,153,247,0.15))]" : ""
            }`}
          >
            <span className="font-semibold text-xs">H</span>
            <span className="text-[10px] opacity-70">▾</span>
          </button>

          {showHeadingMenu && (
            <div className="absolute bottom-9 left-0 w-36 py-1 bg-[#1E242E] border border-[#2B3340] rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 1 }).run();
                  setShowHeadingMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2A3240] hover:text-white flex items-center justify-between ${
                  editor.isActive("heading", { level: 1 }) ? "text-[var(--accent-color,#0399F7)] font-bold" : ""
                }`}
              >
                <span>Heading 1</span>
                <span className="text-[10px] text-gray-500 font-mono">#</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 2 }).run();
                  setShowHeadingMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2A3240] hover:text-white flex items-center justify-between ${
                  editor.isActive("heading", { level: 2 }) ? "text-[var(--accent-color,#0399F7)] font-bold" : ""
                }`}
              >
                <span>Heading 2</span>
                <span className="text-[10px] text-gray-500 font-mono">##</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: 3 }).run();
                  setShowHeadingMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2A3240] hover:text-white flex items-center justify-between ${
                  editor.isActive("heading", { level: 3 }) ? "text-[var(--accent-color,#0399F7)] font-bold" : ""
                }`}
              >
                <span>Heading 3</span>
                <span className="text-[10px] text-gray-500 font-mono">###</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().setParagraph().run();
                  setShowHeadingMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2A3240] hover:text-white flex items-center justify-between ${
                  editor.isActive("paragraph") ? "text-[var(--accent-color,#0399F7)]" : ""
                }`}
              >
                <span>Paragraph</span>
              </button>
            </div>
          )}
        </div>

        {/* Text Style Menu (Bold, Italic, Strikethrough, Underline) */}
        <div className="relative" ref={textRef}>
          <button
            onClick={() => setShowTextMenu(!showTextMenu)}
            title="Text formatting"
            className={`px-2 py-1 rounded flex items-center space-x-0.5 hover:text-white hover:bg-[#262E3B] transition-colors focus:outline-none ${
              editor.isActive("bold") || editor.isActive("italic") || editor.isActive("underline")
                ? "text-[var(--accent-color,#0399F7)] bg-[var(--accent-muted,rgba(3,153,247,0.15))]"
                : ""
            }`}
          >
            <span className="italic font-serif text-xs">I</span>
            <span className="text-[10px] opacity-70">▾</span>
          </button>

          {showTextMenu && (
            <div className="absolute bottom-9 left-0 w-36 py-1 bg-[#1E242E] border border-[#2B3340] rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  toggleSmartBold(editor);
                  setShowTextMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2A3240] hover:text-white flex items-center justify-between ${
                  editor.isActive("bold") ? "text-[var(--accent-color,#0399F7)] font-bold" : ""
                }`}
              >
                <span className="font-bold">Bold</span>
                <span className="text-[10px] text-gray-500 font-mono">**</span>
              </button>
              <button
                onClick={() => {
                  toggleSmartItalic(editor);
                  setShowTextMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2A3240] hover:text-white flex items-center justify-between ${
                  editor.isActive("italic") ? "text-[var(--accent-color,#0399F7)]" : ""
                }`}
              >
                <span className="italic">Italic</span>
                <span className="text-[10px] text-gray-500 font-mono">*</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().toggleStrike().run();
                  setShowTextMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2A3240] hover:text-white flex items-center justify-between ${
                  editor.isActive("strike") ? "text-[var(--accent-color,#0399F7)]" : ""
                }`}
              >
                <span className="line-through">Strikethrough</span>
                <span className="text-[10px] text-gray-500 font-mono">~~</span>
              </button>
              <button
                onClick={() => {
                  toggleSmartUnderline(editor);
                  setShowTextMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2A3240] hover:text-white flex items-center justify-between ${
                  editor.isActive("underline") ? "text-[var(--accent-color,#0399F7)]" : ""
                }`}
              >
                <span className="underline">Underline</span>
              </button>
            </div>
          )}
        </div>

        {/* Link Button */}
        <button
          onClick={handleLink}
          title="Insert Link"
          className={`p-1.5 rounded hover:text-white hover:bg-[#262E3B] transition-colors focus:outline-none ${
            editor.isActive("link") ? "text-[var(--accent-color,#0399F7)] bg-[var(--accent-muted,rgba(3,153,247,0.15))]" : ""
          }`}
        >
          <LinkIcon size={14} />
        </button>

        {/* Inline Code Button */}
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline Code"
          className={`p-1.5 rounded hover:text-white hover:bg-[#262E3B] transition-colors focus:outline-none ${
            editor.isActive("code") ? "text-[var(--accent-color,#0399F7)] bg-[var(--accent-muted,rgba(3,153,247,0.15))]" : ""
          }`}
        >
          <CodeIcon size={14} />
        </button>

        {/* Code Block Button */}
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code Block"
          className={`p-1.5 rounded hover:text-white hover:bg-[#262E3B] transition-colors focus:outline-none ${
            editor.isActive("codeBlock") ? "text-[var(--accent-color,#0399F7)] bg-[var(--accent-muted,rgba(3,153,247,0.15))]" : ""
          }`}
        >
          <CodeBlockIcon size={14} />
        </button>

        {/* Blockquote Button */}
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
          className={`p-1.5 rounded hover:text-white hover:bg-[#262E3B] transition-colors focus:outline-none ${
            editor.isActive("blockquote") ? "text-[var(--accent-color,#0399F7)] bg-[var(--accent-muted,rgba(3,153,247,0.15))]" : ""
          }`}
        >
          <QuoteIcon size={14} />
        </button>

        {/* Lists Menu */}
        <div className="relative" ref={listRef}>
          <button
            onClick={() => setShowListMenu(!showListMenu)}
            title="Lists"
            className={`px-1.5 py-1 rounded flex items-center space-x-0.5 hover:text-white hover:bg-[#262E3B] transition-colors focus:outline-none ${
              editor.isActive("bulletList") || editor.isActive("orderedList") || editor.isActive("taskList")
                ? "text-[var(--accent-color,#0399F7)] bg-[var(--accent-muted,rgba(3,153,247,0.15))]"
                : ""
            }`}
          >
            <ListIcon size={14} />
            <span className="text-[10px] opacity-70">▾</span>
          </button>

          {showListMenu && (
            <div className="absolute bottom-9 left-0 w-36 py-1 bg-[#1E242E] border border-[#2B3340] rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  editor.chain().focus().toggleBulletList().run();
                  setShowListMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2A3240] hover:text-white flex items-center justify-between ${
                  editor.isActive("bulletList") ? "text-[var(--accent-color,#0399F7)] font-semibold" : ""
                }`}
              >
                <span>Bullet List</span>
                <span className="text-[10px] text-gray-500 font-mono">•</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().toggleOrderedList().run();
                  setShowListMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2A3240] hover:text-white flex items-center justify-between ${
                  editor.isActive("orderedList") ? "text-[var(--accent-color,#0399F7)] font-semibold" : ""
                }`}
              >
                <span>Numbered List</span>
                <span className="text-[10px] text-gray-500 font-mono">1.</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().toggleTaskList().run();
                  setShowListMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2A3240] hover:text-white flex items-center justify-between ${
                  editor.isActive("taskList") ? "text-[var(--accent-color,#0399F7)] font-semibold" : ""
                }`}
              >
                <span>Checklist</span>
                <span className="text-[10px] text-gray-500 font-mono">[ ]</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats & Save Indicator Right */}
      <div className="flex items-center space-x-3 text-[11px] text-gray-500 select-none">
        {saveStatus === "saving" && (
          <span className="text-gray-400 flex items-center space-x-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>
            <span>Saving...</span>
          </span>
        )}
        {saveStatus === "error" && (
          <button
            onClick={onRetrySave}
            title="Save failed. Click to retry."
            className="text-red-400 hover:text-red-300 font-semibold flex items-center space-x-1 cursor-pointer focus:outline-none"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
            <span>Save error (retry)</span>
          </button>
        )}
        <span>
          {characterCount} {characterCount === 1 ? "character" : "characters"}
        </span>
      </div>
    </footer>
  );
};
