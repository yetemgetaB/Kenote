import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Selection, TextSelection } from "@tiptap/pm/state";

export const INDENT_SPACES = "    "; // 4 spaces default
export const INDENT_SIZE = 4;

export const SmartCodeBlock = CodeBlockLowlight.extend({
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!this.editor.isActive("codeBlock")) {
          return false;
        }

        const { state, dispatch } = this.editor.view;
        const { selection } = state;
        const { $from, $to, empty } = selection;

        // If no text or single-line selection, simply insert 4 spaces
        if (empty) {
          const tr = state.tr.insertText(INDENT_SPACES, $from.pos, $to.pos);
          dispatch(tr.scrollIntoView());
          return true;
        }

        const node = $from.parent;
        if (node.type.name !== "codeBlock") {
          return false;
        }

        // Check if selection spans multiple lines
        const selectedText = node.textBetween($from.parentOffset, $to.parentOffset, "\n");
        if (!selectedText.includes("\n")) {
          const tr = state.tr.insertText(INDENT_SPACES, $from.pos, $to.pos);
          dispatch(tr.scrollIntoView());
          return true;
        }

        // Multi-line selection: indent every line in selection
        const fullNodeText = node.textContent;
        const blockStartPos = $from.start();
        const startOffset = $from.parentOffset;
        const endOffset = $to.parentOffset;

        // Find the start of the first selected line
        const firstLineStartOffset = fullNodeText.lastIndexOf("\n", startOffset - 1) + 1;
        // Find the end of the last selected line
        let lastLineEndOffset = fullNodeText.indexOf("\n", endOffset);
        if (lastLineEndOffset === -1) {
          lastLineEndOffset = fullNodeText.length;
        }

        const linesText = fullNodeText.slice(firstLineStartOffset, lastLineEndOffset);
        const lines = linesText.split("\n");
        const indentedLines = lines.map((line) => INDENT_SPACES + line).join("\n");

        if (dispatch) {
          const from = blockStartPos + firstLineStartOffset;
          const to = blockStartPos + lastLineEndOffset;
          const tr = state.tr.replaceWith(from, to, state.schema.text(indentedLines));
          dispatch(tr.scrollIntoView());
        }

        return true;
      },

      "Shift-Tab": () => {
        if (!this.editor.isActive("codeBlock")) {
          return false;
        }

        const { state, dispatch } = this.editor.view;
        const { selection } = state;
        const { $from, $to } = selection;
        const node = $from.parent;
        if (node.type.name !== "codeBlock") {
          return false;
        }

        const fullNodeText = node.textContent;
        const blockStartPos = $from.start();
        const startOffset = $from.parentOffset;
        const endOffset = $to.parentOffset;

        // Find the start of the first line
        const firstLineStartOffset = fullNodeText.lastIndexOf("\n", startOffset - 1) + 1;
        // Find the end of the last line
        let lastLineEndOffset = fullNodeText.indexOf("\n", endOffset);
        if (lastLineEndOffset === -1) {
          lastLineEndOffset = fullNodeText.length;
        }

        const linesText = fullNodeText.slice(firstLineStartOffset, lastLineEndOffset);
        const lines = linesText.split("\n");
        const dedentedLines = lines
          .map((line) => {
            const spacesMatch = line.match(/^ {1,4}/);
            if (spacesMatch) {
              return line.slice(spacesMatch[0].length);
            }
            if (line.startsWith("\t")) {
              return line.slice(1);
            }
            return line;
          })
          .join("\n");

        if (linesText === dedentedLines) {
          return true;
        }

        if (dispatch) {
          const from = blockStartPos + firstLineStartOffset;
          const to = blockStartPos + lastLineEndOffset;
          const tr = state.tr.replaceWith(from, to, state.schema.text(dedentedLines));
          dispatch(tr.scrollIntoView());
        }

        return true;
      },

      Enter: () => {
        if (!this.editor.isActive("codeBlock")) {
          return false;
        }

        const { state, dispatch } = this.editor.view;
        const { selection } = state;
        const { $from, $to } = selection;
        const node = $from.parent;
        if (node.type.name !== "codeBlock") {
          return false;
        }

        const blockStartPos = $from.start();
        const textBeforeCursor = node.textBetween(0, $from.parentOffset, "\n");
        const currentLine = textBeforeCursor.split("\n").pop() || "";
        const textAfterCursor = node.textBetween($from.parentOffset, node.content.size, "\n");

        // Check if user is pressing Enter on an empty line at the end of the block to exit code block
        if (currentLine.trim() === "" && textAfterCursor.trim() === "") {
          const lastNewlineOffset = node.textContent.lastIndexOf("\n", $from.parentOffset - 1);
          if (lastNewlineOffset !== -1) {
            return this.editor
              .chain()
              .command(({ tr }) => {
                tr.delete(blockStartPos + lastNewlineOffset, blockStartPos + node.content.size);
                return true;
              })
              .exitCode()
              .run();
          }
          return this.editor.commands.exitCode();
        }

        // Extract current line leading indentation
        const indentMatch = currentLine.match(/^(\s*)/);
        const baseIndent = indentMatch ? indentMatch[1] : "";

        // Check if line opens a block: ends with {, :, [, or (
        const trimmedBefore = currentLine.trimEnd();
        const opensBlock = /[{:[(]$/.test(trimmedBefore);

        // Check if cursor is between matching pairs: { } or [ ] or ( )
        const nextChar = textAfterCursor.charAt(0);
        const isBetweenBrackets =
          (trimmedBefore.endsWith("{") && nextChar === "}") ||
          (trimmedBefore.endsWith("[") && nextChar === "]") ||
          (trimmedBefore.endsWith("(") && nextChar === ")");

        if (isBetweenBrackets) {
          const innerIndent = baseIndent + INDENT_SPACES;
          const textToInsert = "\n" + innerIndent + "\n" + baseIndent;
          const tr = state.tr.insertText(textToInsert, $from.pos, $to.pos);
          const targetCursorPos = $from.pos + 1 + innerIndent.length;
          tr.setSelection(TextSelection.create(tr.doc, targetCursorPos));
          dispatch(tr.scrollIntoView());
          return true;
        }

        const newIndent = opensBlock ? baseIndent + INDENT_SPACES : baseIndent;
        const textToInsert = "\n" + newIndent;
        const tr = state.tr.insertText(textToInsert, $from.pos, $to.pos);
        const targetCursorPos = $from.pos + textToInsert.length;
        tr.setSelection(TextSelection.create(tr.doc, targetCursorPos));
        dispatch(tr.scrollIntoView());
        return true;
      },

      Backspace: () => {
        if (!this.editor.isActive("codeBlock")) {
          return false;
        }

        const { state } = this.editor.view;
        const { selection } = state;
        const { $from, empty } = selection;
        if (!empty) {
          return false;
        }

        const node = $from.parent;
        if (node.type.name !== "codeBlock") {
          return false;
        }

        const textBeforeCursor = node.textBetween(0, $from.parentOffset, "\n");
        const currentLine = textBeforeCursor.split("\n").pop() || "";

        // If line up to cursor consists purely of spaces and has at least 1 indent level:
        if (/^ +$/.test(currentLine) && currentLine.length >= INDENT_SIZE) {
          const remainder = currentLine.length % INDENT_SIZE;
          const deleteCount = remainder === 0 ? INDENT_SIZE : remainder;
          return this.editor.commands.deleteRange({
            from: $from.pos - deleteCount,
            to: $from.pos,
          });
        }

        return false;
      },

      ArrowUp: () => {
        if (!this.editor.isActive("codeBlock")) {
          return false;
        }
        const { state } = this.editor.view;
        const { selection } = state;
        const { $from, empty } = selection;
        if (!empty) return false;

        const node = $from.parent;
        if (node.type.name !== "codeBlock") return false;

        const textBeforeCursor = node.textBetween(0, $from.parentOffset, "\n");
        // If cursor is on the first line (no newline before cursor)
        if (!textBeforeCursor.includes("\n")) {
          const blockPos = $from.before();
          if (blockPos > 0) {
            const prevSel = Selection.findFrom(state.doc.resolve(blockPos), -1);
            if (prevSel) {
              return this.editor.commands.setTextSelection(prevSel.from);
            }
          }
          // If at the very top of the document, insert a paragraph before
          return this.editor
            .chain()
            .insertContentAt(0, { type: "paragraph" })
            .setTextSelection(1)
            .run();
        }
        return false;
      },

      ArrowDown: () => {
        if (!this.editor.isActive("codeBlock")) {
          return false;
        }
        const { state } = this.editor.view;
        const { selection } = state;
        const { $from, empty } = selection;
        if (!empty) return false;

        const node = $from.parent;
        if (node.type.name !== "codeBlock") return false;

        const textAfterCursor = node.textBetween($from.parentOffset, node.content.size, "\n");
        // If cursor is on the last line (no newline after cursor)
        if (!textAfterCursor.includes("\n")) {
          const blockEndPos = $from.after();
          if (blockEndPos < state.doc.content.size) {
            const nextSel = Selection.findFrom(state.doc.resolve(blockEndPos), 1);
            if (nextSel) {
              return this.editor.commands.setTextSelection(nextSel.from);
            }
          }
          // If at the end of the document, exit code into a paragraph
          return this.editor.commands.exitCode();
        }
        return false;
      },

      ArrowLeft: () => {
        if (!this.editor.isActive("codeBlock")) {
          return false;
        }
        const { state } = this.editor.view;
        const { selection } = state;
        const { $from, empty } = selection;
        if (!empty || $from.parentOffset !== 0) return false;

        const node = $from.parent;
        if (node.type.name !== "codeBlock") return false;

        const blockPos = $from.before();
        if (blockPos > 0) {
          const prevSel = Selection.findFrom(state.doc.resolve(blockPos), -1);
          if (prevSel) {
            return this.editor.commands.setTextSelection(prevSel.from);
          }
        }
        return this.editor
          .chain()
          .insertContentAt(0, { type: "paragraph" })
          .setTextSelection(1)
          .run();
      },

      ArrowRight: () => {
        if (!this.editor.isActive("codeBlock")) {
          return false;
        }
        const { state } = this.editor.view;
        const { selection } = state;
        const { $from, empty } = selection;
        const node = $from.parent;
        if (node.type.name !== "codeBlock") return false;
        if (!empty || $from.parentOffset !== node.content.size) return false;

        const blockEndPos = $from.after();
        if (blockEndPos < state.doc.content.size) {
          const nextSel = Selection.findFrom(state.doc.resolve(blockEndPos), 1);
          if (nextSel) {
            return this.editor.commands.setTextSelection(nextSel.from);
          }
        }
        return this.editor.commands.exitCode();
      },
    };
  },
});
