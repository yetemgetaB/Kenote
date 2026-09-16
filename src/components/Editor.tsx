import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import Bold from "@tiptap/extension-bold";
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

// Smart Bold helper: toggles bold on the word around the cursor or on existing selection
export function toggleSmartBold(editor: any): boolean {
  if (!editor || editor.isDestroyed) return false;

  const { state, dispatch } = editor.view;
  const { selection, schema } = state;
  const boldMark = schema.marks.bold;
  if (!boldMark) return false;

  // 1. If selection is not empty, toggle bold on the selection normally
  if (!selection.empty) {
    return editor.chain().focus().toggleBold().run();
  }

  // 2. Collapsed selection (cursor). Inspect word around cursor
  const { $from } = selection;
  const parent = $from.parent;
  if (!parent.isTextblock) {
    return editor.chain().focus().toggleBold().run();
  }

  const text = parent.textContent;
  const offset = $from.parentOffset;

  const isWordChar = (char: string | undefined): boolean => {
    if (!char) return false;
    return /[\p{L}\p{N}_]/u.test(char);
  };

  const isAtWord = isWordChar(text[offset]) || (offset > 0 && isWordChar(text[offset - 1]));
  if (!isAtWord) {
    return editor.chain().focus().toggleBold().run();
  }

  // Scan backwards to word start
  let start = offset;
  if (!isWordChar(text[start]) && start > 0 && isWordChar(text[start - 1])) {
    start = start - 1;
  }
  while (start > 0 && isWordChar(text[start - 1])) {
    start--;
  }

  // Scan forwards to word end
  let end = offset;
  if (isWordChar(text[end])) {
    while (end < text.length && isWordChar(text[end])) {
      end++;
    }
  } else if (offset > 0 && isWordChar(text[offset - 1])) {
    end = offset;
  }

  if (start >= end) {
    return editor.chain().focus().toggleBold().run();
  }

  const from = $from.start() + start;
  const to = $from.start() + end;
  const isCurrentlyBold = state.doc.rangeHasMark(from, to, boldMark);

  const tr = state.tr;
  if (isCurrentlyBold) {
    tr.removeMark(from, to, boldMark);
  } else {
    tr.addMark(from, to, boldMark.create());
  }

  // Preserve cursor position
  const currentPos = $from.pos;
  const clampedPos = Math.min(Math.max(from, currentPos), to);
  tr.setSelection(state.selection.constructor.near(tr.doc.resolve(clampedPos)));

  dispatch(tr);
  return true;
}

// Preserve consecutive blank lines during markdown parsing
export function preserveBlankLines(md: string): string {
  if (!md) return "";
  const parts = md.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part.replace(/(\r?\n){3,}/g, (match) => {
        const count = match.split(/\r?\n/).length - 1;
        const extra = count - 2;
        const breaks = Array(extra).fill("<br>").join("\n\n");
        return `\n\n${breaks}\n\n`;
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
            state.write("<br>");
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

export interface EditorHandle {
  getMarkdown: () => string;
  setMarkdown: (md: string) => void;
  focus: () => void;
  flushCursor: () => void;
  getEditor: () => ReturnType<typeof useEditor>;
}

interface EditorProps {
  noteId?: string | null;
  initialContent: string;
  onChange: (charCount: number, firstLineTitle: string) => void;
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
    const isSwitchingNoteRef = useRef<boolean>(false);
    const prevNoteIdRef = useRef<string | null | undefined>(noteId);

    const saveCursorImmediately = (currentNoteId: string | null | undefined, ed: any) => {
      if (!currentNoteId || !ed || ed.isDestroyed || isSwitchingNoteRef.current) return;
      try {
        const { from, to } = ed.state.selection;
        if (typeof from === "number" && typeof to === "number" && from >= 1) {
          const key = "kenote_cursor_positions";
          const current = JSON.parse(localStorage.getItem(key) || "{}");
          current[currentNoteId] = { from, to };
          localStorage.setItem(key, JSON.stringify(current));
        }
      } catch {}
    };

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
          try {
            ed.commands.setTextSelection({ from, to });
          } catch {
            const resolvedPos = ed.state.doc.resolve(from);
            const sel = ed.state.selection.constructor.near(resolvedPos);
            ed.view.dispatch(ed.state.tr.setSelection(sel));
          }
          ed.commands.scrollIntoView();
        }
      } catch {}
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
        }),
        CustomParagraph,
        CustomBold,
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
        Underline,
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
          transformPastedText: true,
          transformCopiedText: true,
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

        // Efficient live character count and first line title without full AST serialization
        const text = ed.state.doc.textContent;
        const charCount = text.length;

        let firstLineTitle = "Untitled";
        const firstLineMatch = text.match(/^[^\r\n]+/);
        if (firstLineMatch && firstLineMatch[0].trim().length > 0) {
          firstLineTitle = firstLineMatch[0].trim();
        }

        onChange(charCount, firstLineTitle);
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

    useEffect(() => {
      if (editor && onEditorReady) {
        onEditorReady(editor);
        if (noteId) {
          restoreCursor(noteId, editor);
        }
      }
    }, [editor, onEditorReady, noteId]);

    // Set content and restore cursor safely during note switching
    useEffect(() => {
      if (!editor || !noteId) return;

      if (prevNoteIdRef.current !== noteId) {
        if (prevNoteIdRef.current) {
          saveCursorImmediately(prevNoteIdRef.current, editor);
        }
        prevNoteIdRef.current = noteId;
        isSwitchingNoteRef.current = true;
        editor.commands.setContent(preserveBlankLines(initialContent || ""), false);
        requestAnimationFrame(() => {
          restoreCursor(noteId, editor);
          setTimeout(() => {
            isSwitchingNoteRef.current = false;
          }, 100);
        });
      }
    }, [noteId, initialContent, editor]);

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        if (!editor || editor.isDestroyed) return "";
        return (editor.storage as any).markdown?.getMarkdown() || "";
      },
      setMarkdown: (md: string) => {
        if (editor && !editor.isDestroyed) {
          isSwitchingNoteRef.current = true;
          editor.commands.setContent(preserveBlankLines(md), false);
          if (noteId) {
            restoreCursor(noteId, editor);
          }
          setTimeout(() => {
            isSwitchingNoteRef.current = false;
          }, 100);
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
