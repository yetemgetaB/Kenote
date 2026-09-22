import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer, Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Markdown } from "tiptap-markdown";
import { common, createLowlight } from "lowlight";
import { CodeBlockComponent } from "./CodeBlockComponent";
import { api, isValidExternalUrl } from "../utils/tauriBridge";

const lowlight = createLowlight(common);

import { createSafeSelection } from "../utils/selection";
export { createSafeSelection };

import {
  type SmartMarkType,
  toggleSmartMark,
  toggleSmartBold,
  toggleSmartItalic,
  toggleSmartUnderline,
} from "../utils/formatting";
export {
  type SmartMarkType,
  toggleSmartMark,
  toggleSmartBold,
  toggleSmartItalic,
  toggleSmartUnderline,
};

// Preserve consecutive blank lines during markdown parsing
export function preserveBlankLines(md: string): string {
  if (!md) return "";
  const parts = md.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part.replace(/(\r?\n){3,}/g, (match) => {
        const count = match.split(/\r?\n/).length - 1;
        const extraEmptyParagraphs = count - 2;
        const emptyTags = Array(extraEmptyParagraphs).fill("<p></p>").join("\n");
        return `\n\n${emptyTags}\n\n`;
      });
    })
    .join("");
}

// Custom Paragraph with proper empty-line serialization to prevent losing multiple Enters
export const CustomParagraph = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          if (node.childCount === 0) {
            state.write("");
            state.closeBlock(node);
          } else {
            state.renderInline(node);
            state.closeBlock(node);
          }
        },
        parse: {},
      },
    };
  },
});

// Custom TaskList with tight attribute support to prevent extra blank lines in task lists
export const CustomTaskList = TaskList.extend({
  addAttributes() {
    return {
      tight: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-tight") === "true" || !element.querySelector("p"),
        renderHTML: (attributes) => ({
          class: attributes.tight ? "tight" : null,
          "data-tight": attributes.tight ? "true" : null,
        }),
      },
    };
  },
});

// Custom Bold extension with smart word boundary formatting
export const CustomBold = Bold.extend({
  addKeyboardShortcuts() {
    return {
      "Mod-b": () => toggleSmartBold(this.editor),
      "Mod-B": () => toggleSmartBold(this.editor),
    };
  },
});

// Custom Italic extension with smart word boundary formatting
export const CustomItalic = Italic.extend({
  addKeyboardShortcuts() {
    return {
      "Mod-i": () => toggleSmartItalic(this.editor),
      "Mod-I": () => toggleSmartItalic(this.editor),
    };
  },
});

// Custom Underline extension with smart word boundary formatting
export const CustomUnderline = Underline.extend({
  addKeyboardShortcuts() {
    return {
      "Mod-u": () => toggleSmartUnderline(this.editor),
      "Mod-U": () => toggleSmartUnderline(this.editor),
    };
  },
});

export interface EditorHandle {
  getMarkdown: () => string;
  setMarkdown: (md: string) => void;
  focus: () => void;
  flushCursor: () => void;
  getEditor: () => ReturnType<typeof useEditor>;
}

import { computeDocumentStats } from "../utils/documentStats";
export { computeDocumentStats };

interface EditorProps {
  noteId?: string | null;
  initialContent: string;
  onChange: (charCount: number, wordCount: number, firstLineTitle: string) => void;
  fontSize?: string;
  lineHeight?: string;
  fontFamily?: string;
  onEditorReady?: (editor: TiptapEditor) => void;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(
  (
    {
      noteId,
      initialContent,
      onChange,
      fontSize = "15px",
      lineHeight = "1.6",
      fontFamily = "system-ui",
      onEditorReady,
    },
    ref
  ) => {
    const cursorSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isSwitchingNoteRef = useRef<boolean>(false);
    const prevNoteIdRef = useRef<string | null | undefined>(noteId);

    const saveCursorImmediately = (currentNoteId: string | null | undefined, ed: TiptapEditor) => {
      if (!currentNoteId || !ed || ed.isDestroyed || isSwitchingNoteRef.current) return;
      try {
        const { from, to } = ed.state.selection;
        if (typeof from === "number" && typeof to === "number" && from >= 1) {
          const $from = ed.state.doc.resolve(from);
          if ($from.parent.inlineContent) {
            const key = "kenote_cursor_positions";
            const current = JSON.parse(localStorage.getItem(key) || "{}");
            current[currentNoteId] = { from, to };
            localStorage.setItem(key, JSON.stringify(current));
          }
        }
      } catch {}
    };

    const restoreCursor = (currentNoteId: string, ed: TiptapEditor) => {
      if (!ed || ed.isDestroyed) return;
      try {
        const key = "kenote_cursor_positions";
        const savedMap = JSON.parse(localStorage.getItem(key) || "{}");
        const savedPos = savedMap[currentNoteId];

        if (savedPos && typeof savedPos.from === "number") {
          const safeSel = createSafeSelection(ed.state.doc, savedPos.from, savedPos.to);
          if (safeSel) {
            ed.view.dispatch(ed.state.tr.setSelection(safeSel));
            ed.commands.scrollIntoView();
          }
        }
      } catch (err) {
        console.warn("Could not restore cursor position:", err);
      }
    };

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
          codeBlock: false,
          paragraph: false,
          bold: false,
          italic: false,
        }),
        CustomParagraph,
        CustomBold,
        CustomItalic,
        CustomUnderline,
        CodeBlockLowlight.extend({
          addNodeView() {
            return ReactNodeViewRenderer(CodeBlockComponent);
          },
        }).configure({
          lowlight,
        }),
        CustomTaskList,
        TaskItem.configure({
          nested: true,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: "text-[var(--accent-color,#0399F7)] underline cursor-pointer hover:opacity-80",
            rel: "noopener noreferrer",
          },
        }),
        Placeholder.configure({
          placeholder: "Start writing...",
          emptyEditorClass: "is-editor-empty",
        }),
        Markdown.configure({
          html: true,
          transformPastedText: false,
          transformCopiedText: false,
        }),
      ],
      content: preserveBlankLines(initialContent || ""),
      editorProps: {
        attributes: {
          class:
            "focus:outline-none min-h-[calc(100vh-100px)] px-6 py-5 prose prose-invert max-w-none text-[#D8E1E8]",
          style: `font-size: ${fontSize}; line-height: ${lineHeight}; font-family: ${fontFamily};`,
        },
        handleClick: (_view, _pos, event) => {
          const target = event.target as HTMLElement;
          const anchor = target?.closest("a");
          if (anchor) {
            const href = anchor.getAttribute("href") || "";
            if (isValidExternalUrl(href)) {
              event.preventDefault();
              api.openExternal(href);
              return true;
            }
          }
          return false;
        },
        handleKeyDown: (_view, event) => {
          // Prevent Windows Insert key from toggling terminal overwrite mode
          if (event.key === "Insert") {
            event.preventDefault();
            return true;
          }
          return false;
        },
      },
      onSelectionUpdate: ({ editor: ed }) => {
        if (!noteId || !ed || isSwitchingNoteRef.current) return;
        if (cursorSaveTimeoutRef.current) {
          clearTimeout(cursorSaveTimeoutRef.current);
        }
        cursorSaveTimeoutRef.current = setTimeout(() => {
          if (isSwitchingNoteRef.current) return;
          saveCursorImmediately(noteId, ed);
        }, 100);
      },
      onUpdate: ({ editor: ed }) => {
        if (!ed || ed.isDestroyed) return;

        const text = ed.state.doc.textContent;
        const { charCount, wordCount, firstLineTitle } = computeDocumentStats(text);

        onChange(charCount, wordCount, firstLineTitle);
      },
    });

    useEffect(() => {
      return () => {
        if (cursorSaveTimeoutRef.current) {
          clearTimeout(cursorSaveTimeoutRef.current);
        }
        if (prevNoteIdRef.current && editor && !editor.isDestroyed) {
          saveCursorImmediately(prevNoteIdRef.current, editor);
        }
      };
    }, [editor]);

    const onEditorReadyRef = useRef(onEditorReady);
    useEffect(() => {
      onEditorReadyRef.current = onEditorReady;
    }, [onEditorReady]);

    const hasRestoredInitialCursorRef = useRef(false);

    useEffect(() => {
      if (editor && !hasRestoredInitialCursorRef.current) {
        hasRestoredInitialCursorRef.current = true;
        const text = editor.state.doc.textContent;
        const { charCount, wordCount, firstLineTitle } = computeDocumentStats(text);
        onChange(charCount, wordCount, firstLineTitle);
        onEditorReadyRef.current?.(editor);
        if (noteId) {
          restoreCursor(noteId, editor);
        }
      }
    }, [editor, noteId, onChange]);

    // Set content and restore cursor safely during note switching
    useEffect(() => {
      if (!editor || !noteId) return;

      if (prevNoteIdRef.current !== noteId) {
        if (cursorSaveTimeoutRef.current) {
          clearTimeout(cursorSaveTimeoutRef.current);
          cursorSaveTimeoutRef.current = null;
        }
        if (prevNoteIdRef.current) {
          saveCursorImmediately(prevNoteIdRef.current, editor);
        }
        prevNoteIdRef.current = noteId;
        isSwitchingNoteRef.current = true;
        editor.commands.setContent(preserveBlankLines(initialContent || ""), false);
        const text = editor.state.doc.textContent;
        const { charCount, wordCount, firstLineTitle } = computeDocumentStats(text);
        onChange(charCount, wordCount, firstLineTitle);
        restoreCursor(noteId, editor);
        isSwitchingNoteRef.current = false;
      }
    }, [noteId, initialContent, editor, onChange]);

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        if (!editor || editor.isDestroyed) return "";
        return (editor.storage as any).markdown?.getMarkdown() || "";
      },
      setMarkdown: (md: string) => {
        if (editor && !editor.isDestroyed) {
          if (cursorSaveTimeoutRef.current) {
            clearTimeout(cursorSaveTimeoutRef.current);
            cursorSaveTimeoutRef.current = null;
          }
          isSwitchingNoteRef.current = true;
          editor.commands.setContent(preserveBlankLines(md), false);
          const text = editor.state.doc.textContent;
          const { charCount, wordCount, firstLineTitle } = computeDocumentStats(text);
          onChange(charCount, wordCount, firstLineTitle);
          if (noteId) {
            restoreCursor(noteId, editor);
          }
          isSwitchingNoteRef.current = false;
        }
      },
      focus: () => {
        editor?.commands.focus();
      },
      flushCursor: () => {
        if (noteId && editor && !editor.isDestroyed) {
          saveCursorImmediately(noteId, editor);
        }
      },
      getEditor: () => editor,
    }));

    return (
      <div className="flex-1 w-full overflow-y-auto custom-scrollbar relative">
        <EditorContent editor={editor} />
      </div>
    );
  }
);

Editor.displayName = "Editor";
