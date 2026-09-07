import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Markdown } from "tiptap-markdown";
import { common, createLowlight } from "lowlight";
import { CodeBlockComponent } from "./CodeBlockComponent";

const lowlight = createLowlight(common);

export interface EditorHandle {
  getMarkdown: () => string;
  setMarkdown: (md: string) => void;
  focus: () => void;
  getEditor: () => ReturnType<typeof useEditor>;
}

interface EditorProps {
  noteId?: string | null;
  initialContent: string;
  onChange: (markdown: string, charCount: number, firstLineTitle: string) => void;
  fontSize?: string;
  lineHeight?: string;
  fontFamily?: string;
  onEditorReady?: (editor: any) => void;
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
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
          codeBlock: false,
        }),
        CodeBlockLowlight.extend({
          addNodeView() {
            return ReactNodeViewRenderer(CodeBlockComponent);
          },
        }).configure({
          lowlight,
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: "text-[var(--accent-color,#0399F7)] underline cursor-pointer hover:opacity-80",
          },
        }),
        Placeholder.configure({
          placeholder: "Start writing...",
          emptyEditorClass: "is-editor-empty",
        }),
        Markdown.configure({
          html: true,
          transformPastedText: true,
          transformCopiedText: true,
        }),
      ],
      content: initialContent,
      editorProps: {
        attributes: {
          class:
            "focus:outline-none min-h-[calc(100vh-100px)] px-6 py-5 prose prose-invert max-w-none text-[#D8E1E8]",
          style: `font-size: ${fontSize}; line-height: ${lineHeight}; font-family: ${fontFamily};`,
        },
      },
      onSelectionUpdate: ({ editor: ed }) => {
        if (!noteId || !ed) return;
        if (cursorSaveTimeoutRef.current) {
          clearTimeout(cursorSaveTimeoutRef.current);
        }
        cursorSaveTimeoutRef.current = setTimeout(() => {
          try {
            const { from, to } = ed.state.selection;
            const key = "kenote_cursor_positions";
            const current = JSON.parse(localStorage.getItem(key) || "{}");
            current[noteId] = { from, to };
            localStorage.setItem(key, JSON.stringify(current));
          } catch {}
        }, 150);
      },
      onUpdate: ({ editor: ed }) => {
        if (!ed || ed.isDestroyed) return;

        // Immediate live text and character count updates for responsive UI
        const text = ed.getText();
        const charCount = text.length;

        let firstLineTitle = "Untitled";
        const lines = text.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length > 0) {
            firstLineTitle = trimmed;
            break;
          }
        }

        // Immediately update character count & title in UI
        const currentMarkdown = (ed.storage as any).markdown?.getMarkdown() || "";
        onChange(currentMarkdown, charCount, firstLineTitle);
      },
    });

    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        if (cursorSaveTimeoutRef.current) {
          clearTimeout(cursorSaveTimeoutRef.current);
        }
      };
    }, []);

    // Function to restore cursor position for note
    const restoreCursor = (currentNoteId: string, ed: any) => {
      if (!ed || ed.isDestroyed) return;
      try {
        const key = "kenote_cursor_positions";
        const savedMap = JSON.parse(localStorage.getItem(key) || "{}");
        const savedPos = savedMap[currentNoteId];
        const docSize = ed.state.doc.content.size;

        if (savedPos && typeof savedPos.from === "number") {
          const from = Math.min(Math.max(1, savedPos.from), docSize);
          const to = Math.min(Math.max(from, savedPos.to ?? from), docSize);
          ed.commands.setTextSelection({ from, to });
          ed.commands.scrollIntoView();
        }
      } catch {}
    };

    // Restore cursor position when editor is initialized
    useEffect(() => {
      if (editor && noteId) {
        const timer = setTimeout(() => {
          restoreCursor(noteId, editor);
        }, 20);
        return () => clearTimeout(timer);
      }
    }, [editor, noteId]);

    useEffect(() => {
      if (editor && onEditorReady) {
        const timer = setTimeout(() => {
          onEditorReady(editor);
        }, 0);
        return () => clearTimeout(timer);
      }
    }, [editor, onEditorReady]);

    // Only set content and restore cursor when actually switching to a different note
    const prevNoteIdRef = useRef<string | null | undefined>(noteId);
    useEffect(() => {
      if (!editor || !noteId) return;

      if (prevNoteIdRef.current !== noteId) {
        prevNoteIdRef.current = noteId;
        const timer = setTimeout(() => {
          if (!editor.isDestroyed) {
            editor.commands.setContent(initialContent || "", false);
            restoreCursor(noteId, editor);
          }
        }, 0);
        return () => clearTimeout(timer);
      }
    }, [noteId, initialContent, editor]);

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        if (!editor) return "";
        return (editor.storage as any).markdown?.getMarkdown() || "";
      },
      setMarkdown: (md: string) => {
        if (editor) {
          editor.commands.setContent(md, false);
        }
      },
      focus: () => {
        editor?.commands.focus();
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
