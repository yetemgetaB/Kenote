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
      initialContent,
      onChange,
      fontSize = "15px",
      lineHeight = "1.6",
      fontFamily = "system-ui",
      onEditorReady,
    },
    ref
  ) => {
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
      onUpdate: ({ editor: ed }) => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          if (!ed || ed.isDestroyed) return;
          const markdown = (ed.storage as any).markdown?.getMarkdown() || "";
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

          onChange(markdown, charCount, firstLineTitle);
        }, 150);
      },
    });

    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (editor && onEditorReady) {
        queueMicrotask(() => {
          onEditorReady(editor);
        });
      }
    }, [editor, onEditorReady]);

    // Handle content updates when switching notes
    useEffect(() => {
      if (editor && initialContent !== undefined) {
        const currentMd = (editor.storage as any).markdown?.getMarkdown();
        if (currentMd !== initialContent) {
          editor.commands.setContent(initialContent, false);
        }
      }
    }, [initialContent, editor]);

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
