import React, { useState, useEffect } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { NoteMetadata } from "../types/note";
import {
  exportToPdf,
  exportToHtml,
  exportToMarkdown,
  exportToPlainText,
  copyRichText,
  exportAllNotesToFolder,
} from "../utils/exportNote";
import {
  CopyIcon,
  ExportIcon,
  FileTextIcon,
  FolderIcon,
} from "./Icons";

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeNote: NoteMetadata | null;
  editor: TiptapEditor | null;
  allNotes: NoteMetadata[];
  onShowToast: (message: string) => void;
}

interface ExportOption {
  id: string;
  title: string;
  description: string;
  keyBadge: string;
  icon: React.ReactNode;
  action: () => void | Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  activeNote,
  editor,
  allNotes,
  onShowToast,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const noteTitle = activeNote?.title || "Untitled";
  const noteMarkdown = activeNote?.content || "";
  const bodyHtml = editor?.getHTML() || "";
  const plainText = editor?.getText() || "";

  const options: ExportOption[] = [
    {
      id: "pdf",
      title: "PDF Document (.pdf)",
      description: "Print or save as PDF with clean document layout",
      keyBadge: "P",
      icon: <FileTextIcon size={16} className="text-[#38BDF8]" />,
      action: () => {
        onClose();
        setTimeout(() => exportToPdf(), 100);
      },
    },
    {
      id: "copy_rich",
      title: "Copy Formatted Rich Text",
      description: "Copy styled HTML to clipboard for Slack, Gmail, or Docs",
      keyBadge: "C",
      icon: <CopyIcon size={16} className="text-[#34D399]" />,
      action: async () => {
        if (!editor) return;
        const success = await copyRichText(editor);
        onClose();
        onShowToast(success ? "Formatted text copied to clipboard!" : "Failed to copy rich text");
      },
    },
    {
      id: "html",
      title: "Standalone HTML Page (.html)",
      description: "Single self-contained web file with embedded styles",
      keyBadge: "H",
      icon: <ExportIcon size={16} className="text-[#818CF8]" />,
      action: async () => {
        onClose();
        const saved = await exportToHtml(noteTitle, bodyHtml);
        if (saved) onShowToast("HTML file saved successfully");
      },
    },
    {
      id: "markdown",
      title: "Markdown Document (.md)",
      description: "Standard portable markdown document",
      keyBadge: "M",
      icon: <FileTextIcon size={16} className="text-[#FBBF24]" />,
      action: async () => {
        onClose();
        const saved = await exportToMarkdown(noteTitle, noteMarkdown);
        if (saved) onShowToast("Markdown file saved successfully");
      },
    },
    {
      id: "plain",
      title: "Plain Text (.txt)",
      description: "Unformatted text file stripped of markdown symbols",
      keyBadge: "T",
      icon: <FileTextIcon size={16} className="text-[#94A3B8]" />,
      action: async () => {
        onClose();
        const saved = await exportToPlainText(noteTitle, plainText);
        if (saved) onShowToast("Plain text file saved successfully");
      },
    },
    {
      id: "backup_all",
      title: "Export All Notes (Vault Backup)",
      description: `Save all ${allNotes.length} notes into a backup folder`,
      keyBadge: "B",
      icon: <FolderIcon size={16} className="text-[#A78BFA]" />,
      action: async () => {
        onClose();
        try {
          const res = await exportAllNotesToFolder(allNotes);
          if (res) onShowToast(`Successfully exported ${res.count} notes!`);
        } catch {
          onShowToast("Failed to backup notes folder");
        }
      },
    },
  ];

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        options[selectedIndex]?.action();
      } else {
        const key = e.key.toUpperCase();
        const match = options.find((opt) => opt.keyBadge === key);
        if (match && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          match.action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, options, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] bg-[#1B2028] border border-[#2B3442] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#262E3B] flex items-center justify-between bg-[#161B22]">
          <div className="flex items-center space-x-2">
            <ExportIcon size={16} className="text-[var(--accent-color,#0399F7)]" />
            <span className="text-sm font-semibold text-gray-200">Export Note</span>
          </div>
          <span className="text-[11px] text-gray-400 bg-[#222A36] px-2 py-0.5 rounded border border-[#2E3848] truncate max-w-[200px]">
            {noteTitle}
          </span>
        </div>

        {/* Options list */}
        <div className="p-2 space-y-1 max-h-[380px] overflow-y-auto custom-scrollbar">
          {options.map((opt, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <div
                key={opt.id}
                onClick={() => opt.action()}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                  isSelected
                    ? "bg-[#273243] text-white border border-[#3A495E]/60 shadow-sm"
                    : "text-gray-300 hover:bg-[#202733] border border-transparent"
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className="p-1.5 rounded-lg bg-[#141820]/80 border border-[#2B3545] shrink-0">
                    {opt.icon}
                  </div>
                  <div className="truncate text-left">
                    <div className="text-xs font-medium truncate">{opt.title}</div>
                    <div className="text-[11px] text-gray-400 truncate">{opt.description}</div>
                  </div>
                </div>
                <kbd
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                    isSelected
                      ? "bg-[#1E2530] text-gray-200 border-[#3B485A]"
                      : "bg-[#161B22] text-gray-400 border-[#27303E]"
                  }`}
                >
                  {opt.keyBadge}
                </kbd>
              </div>
            );
          })}
        </div>

        {/* Footer tip */}
        <div className="px-4 py-2 bg-[#141820] border-t border-[#232B37] flex items-center justify-between text-[11px] text-gray-400">
          <span>Use ↑↓ arrows or hotkey to select</span>
          <span className="font-mono text-[10px] text-gray-500">Esc to close</span>
        </div>
      </div>
    </div>
  );
};
