import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";

export const INDENT_SPACES = "    "; // 4 spaces default
export const INDENT_SIZE = 4;

export const SmartCodeBlock = CodeBlockLowlight.extend({
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
          return this.editor.commands.insertContent(INDENT_SPACES);
        }

        const node = $from.parent;
        if (node.type.name !== "codeBlock") {
          return false;
        }

        // Check if selection spans multiple lines
        const selectedText = node.textBetween($from.parentOffset, $to.parentOffset, "\n");
        if (!selectedText.includes("\n")) {
          return this.editor.commands.insertContent(INDENT_SPACES);
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
          dispatch(tr);
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
          dispatch(tr);
        }

        return true;
      },

      Enter: () => {
        if (!this.editor.isActive("codeBlock")) {
          return false;
        }

        const { state } = this.editor.view;
        const { selection } = state;
        const { $from } = selection;
        const node = $from.parent;
        if (node.type.name !== "codeBlock") {
          return false;
        }

        const textBeforeCursor = node.textBetween(0, $from.parentOffset, "\n");
        const currentLine = textBeforeCursor.split("\n").pop() || "";

        // Extract current line leading indentation
        const indentMatch = currentLine.match(/^(\s*)/);
        const baseIndent = indentMatch ? indentMatch[1] : "";

        // Check if line opens a block: ends with {, :, [, or (
        const trimmedBefore = currentLine.trimEnd();
        const opensBlock = /[{:[(]$/.test(trimmedBefore);

        // Check if cursor is between matching pairs: { } or [ ] or ( )
        const textAfterCursor = node.textBetween($from.parentOffset, node.content.size, "\n");
        const nextChar = textAfterCursor.charAt(0);
        const isBetweenBrackets =
          (trimmedBefore.endsWith("{") && nextChar === "}") ||
          (trimmedBefore.endsWith("[") && nextChar === "]") ||
          (trimmedBefore.endsWith("(") && nextChar === ")");

        if (isBetweenBrackets) {
          const innerIndent = baseIndent + INDENT_SPACES;
          return this.editor
            .chain()
            .insertContent("\n" + innerIndent + "\n" + baseIndent)
            .setTextSelection($from.pos + 1 + innerIndent.length)
            .run();
        }

        const newIndent = opensBlock ? baseIndent + INDENT_SPACES : baseIndent;
        return this.editor.commands.insertContent("\n" + newIndent);
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
    };
  },
});
