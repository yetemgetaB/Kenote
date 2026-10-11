import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";

export interface SectionOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    section: {
      /**
       * Insert a new section at the current selection or block position
       */
      insertSection: (attributes?: { title?: string }) => ReturnType;
      /**
       * Set or insert a section block
       */
      setSection: (attributes?: { title?: string }) => ReturnType;
      /**
       * Exit section downwards into the node after the section or create a new paragraph below
       */
      exitSectionDown: () => ReturnType;
      /**
       * Exit section upwards into the node before the section or create a new paragraph above
       */
      exitSectionUp: () => ReturnType;
    };
  }
}

/**
 * markdown-it block parser rule for KeNote :::kenote-section containers
 */
function setupMarkdownItSection(md: any) {
  if (!md || md.__kenote_section_registered) return;
  md.__kenote_section_registered = true;

  function kenoteSectionBlock(state: any, startLine: number, endLine: number, silent: boolean): boolean {
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];

    // Must start with ':'
    if (state.src.charCodeAt(pos) !== 0x3a /* : */) {
      return false;
    }

    const start = pos;
    while (pos < max && state.src.charCodeAt(pos) === 0x3a) {
      pos++;
    }

    const markerCount = pos - start;
    if (markerCount < 3) {
      return false;
    }

    const marker = state.src.slice(start, pos);
    const restOfLine = state.src.slice(pos, max).trim();

    if (!restOfLine.startsWith("kenote-section")) {
      return false;
    }

    // Extract title attribute if present
    const afterKeyword = restOfLine.slice("kenote-section".length).trim();
    let title = "";
    if (afterKeyword.startsWith('title="')) {
      const titleMatch = afterKeyword.match(/^title="((?:[^"\\]|\\.)*)"/);
      if (titleMatch) {
        title = titleMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
    }

    if (silent) {
      return true;
    }

    // Scan forward for matching closing fence with exact markerCount
    let nextLine = startLine;
    let autoClosed = false;

    for (;;) {
      nextLine++;
      if (nextLine >= endLine) {
        autoClosed = true;
        break;
      }

      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];

      if (state.src.charCodeAt(pos) === 0x3a) {
        const closeStart = pos;
        while (pos < max && state.src.charCodeAt(pos) === 0x3a) {
          pos++;
        }
        const closeCount = pos - closeStart;
        const tail = state.src.slice(pos, max).trim();

        if (closeCount === markerCount && (tail === "" || tail === "kenote-section")) {
          break;
        }
      }
    }

    const oldParent = state.parentType;
    const oldLineMax = state.lineMax;
    state.parentType = "container";
    state.lineMax = nextLine;

    const token_o = state.push("kenote_section_open", "div", 1);
    token_o.markup = marker;
    token_o.block = true;
    token_o.info = restOfLine;
    token_o.attrs = [
      ["data-type", "section"],
      ["data-title", title],
    ];
    token_o.map = [startLine, nextLine];

    // Tokenize child block nodes inside the section
    state.md.block.tokenize(state, startLine + 1, nextLine);

    const token_c = state.push("kenote_section_close", "div", -1);
    token_c.markup = marker;
    token_c.block = true;
    token_c.map = [nextLine, nextLine + (autoClosed ? 0 : 1)];

    state.parentType = oldParent;
    state.lineMax = oldLineMax;
    state.line = autoClosed ? nextLine : nextLine + 1;

    return true;
  }

  // Register container rule before standard fence/codeblock rules
  md.block.ruler.before("fence", "kenote_section", kenoteSectionBlock, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });

  md.renderer.rules.kenote_section_open = function (tokens: any[], idx: number) {
    const token = tokens[idx];
    const title = token.attrGet("data-title") || "";
    return `<div data-type="section" data-title="${md.utils.escapeHtml(title)}">\n`;
  };

  md.renderer.rules.kenote_section_close = function () {
    return "</div>\n";
  };
}

export const Section = Node.create<SectionOptions>({
  name: "section",

  group: "block",

  content: "block+",

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      title: {
        default: "Untitled Section",
        parseHTML: (element) => element.getAttribute("data-title") ?? "Untitled Section",
        renderHTML: (attributes) => ({
          "data-title": typeof attributes.title === "string" ? attributes.title : "Untitled Section",
        }),
      },
      _autoFocus: {
        default: false,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="section"]',
      },
      {
        tag: "section",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "section",
        class: "kenote-section",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertSection:
        (attributes) =>
        ({ state, dispatch, tr }) => {
          const title = attributes?.title ?? "Untitled Section";
          const sectionType = this.type;
          const paragraphType = state.schema.nodes.paragraph;

          if (!paragraphType) {
            return false;
          }

          // Create a valid section node containing one empty paragraph
          const sectionNode = sectionType.create(
            { title, _autoFocus: true },
            paragraphType.create()
          );

          if (!sectionNode) {
            return false;
          }

          if (dispatch) {
            const { selection } = state;
            const { $from } = selection;

            // Check if cursor is currently inside a section node
            let enclosingSectionDepth = -1;
            for (let d = $from.depth; d > 0; d--) {
              if ($from.node(d).type === sectionType) {
                enclosingSectionDepth = d;
                break;
              }
            }

            // If current block is an empty paragraph at document root level, replace it
            const isRootEmptyParagraph =
              $from.depth === 1 &&
              $from.parent.type === paragraphType &&
              $from.parent.content.size === 0;

            if (isRootEmptyParagraph) {
              const fromPos = $from.before();
              const toPos = $from.after();
              tr.replaceWith(fromPos, toPos, sectionNode);
              const resolved = tr.doc.resolve(fromPos + 1);
              tr.setSelection(Selection.near(resolved));
            } else if (enclosingSectionDepth > 0) {
              // When inside an existing section, insert as a sibling AFTER the enclosing section
              const insertPos = $from.after(enclosingSectionDepth);
              tr.insert(insertPos, sectionNode);
              const resolved = tr.doc.resolve(insertPos + 1);
              tr.setSelection(Selection.near(resolved));
            } else {
              // Insert after current block at root/current depth
              const insertDepth = Math.max(1, $from.depth);
              const insertPos = $from.after(insertDepth);
              tr.insert(insertPos, sectionNode);
              const resolved = tr.doc.resolve(insertPos + 1);
              tr.setSelection(Selection.near(resolved));
            }

            dispatch(tr.scrollIntoView());
          }

          return true;
        },
      setSection:
        (attributes) =>
        ({ commands }) => {
          return commands.insertSection(attributes);
        },
      exitSectionDown:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const { $from } = selection;

          let sectionDepth = -1;
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type === this.type) {
              sectionDepth = d;
              break;
            }
          }

          if (sectionDepth === -1) {
            return false;
          }

          const sectionAfterPos = $from.after(sectionDepth);

          if (sectionAfterPos >= state.doc.content.size) {
            const paragraphType = state.schema.nodes.paragraph;
            if (paragraphType && dispatch) {
              const tr = state.tr.insert(sectionAfterPos, paragraphType.create());
              tr.setSelection(Selection.near(tr.doc.resolve(sectionAfterPos + 1)));
              dispatch(tr.scrollIntoView());
              return true;
            }
          } else if (dispatch) {
            const resolved = state.doc.resolve(sectionAfterPos + 1);
            const tr = state.tr.setSelection(Selection.near(resolved));
            dispatch(tr.scrollIntoView());
            return true;
          }

          return false;
        },
      exitSectionUp:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const { $from } = selection;

          let sectionDepth = -1;
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type === this.type) {
              sectionDepth = d;
              break;
            }
          }

          if (sectionDepth === -1) {
            return false;
          }

          const sectionBeforePos = $from.before(sectionDepth);

          if (sectionBeforePos <= 0) {
            const paragraphType = state.schema.nodes.paragraph;
            if (paragraphType && dispatch) {
              const tr = state.tr.insert(0, paragraphType.create());
              tr.setSelection(Selection.near(tr.doc.resolve(1)));
              dispatch(tr.scrollIntoView());
              return true;
            }
          } else if (dispatch) {
            const resolved = state.doc.resolve(sectionBeforePos - 1);
            const tr = state.tr.setSelection(Selection.near(resolved));
            dispatch(tr.scrollIntoView());
            return true;
          }

          return false;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-s": () => this.editor.commands.insertSection(),
      "Mod-Shift-S": () => this.editor.commands.insertSection(),
      ArrowDown: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;

        let sectionDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type === this.type) {
            sectionDepth = d;
            break;
          }
        }

        if (sectionDepth === -1) {
          return false;
        }

        const sectionEndPos = $from.end(sectionDepth);
        const parentEndPos = $from.end();
        const isAtSectionEnd =
          $from.pos >= sectionEndPos - 1 ||
          ($from.pos >= parentEndPos && $from.index(sectionDepth) === $from.node(sectionDepth).childCount - 1);

        if (!isAtSectionEnd) {
          return false;
        }

        return this.editor.commands.exitSectionDown();
      },
      ArrowUp: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;

        let sectionDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type === this.type) {
            sectionDepth = d;
            break;
          }
        }

        if (sectionDepth === -1) {
          return false;
        }

        const sectionStartPos = $from.start(sectionDepth);
        const parentStartPos = $from.start();
        const isAtSectionStart =
          $from.pos <= sectionStartPos + 1 ||
          ($from.pos <= parentStartPos && $from.index(sectionDepth) === 0);

        if (!isAtSectionStart) {
          return false;
        }

        return this.editor.commands.exitSectionUp();
      },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^:::([^\n]*)\s$/,
        handler: ({ state, range, match }) => {
          const rawTitle = match[1]?.trim() || "";
          const title = rawTitle || "Untitled Section";
          const sectionType = this.type;
          const paragraphType = state.schema.nodes.paragraph;

          if (!paragraphType) {
            return;
          }

          const sectionNode = sectionType.create(
            { title, _autoFocus: !rawTitle },
            paragraphType.create()
          );

          const { tr } = state;
          const { $from } = state.selection;
          const isRootEmptyParagraph =
            $from.depth === 1 &&
            $from.parent.type === paragraphType &&
            $from.parent.content.size === range.to - range.from;

          if (isRootEmptyParagraph) {
            tr.replaceWith($from.before(), $from.after(), sectionNode);
          } else {
            tr.delete(range.from, range.to);
            tr.insert(range.from, sectionNode);
          }
          tr.scrollIntoView();
        },
      }),
    ];
  },

  addStorage() {
    return {
      markdown: {
        parse: {
          setup(md: any) {
            setupMarkdownItSection(md);
          },
        },
        serialize(state: any, node: any) {
          const depth = (state.sectionDepth || 0) + 1;
          state.sectionDepth = depth;
          const colons = ":".repeat(Math.max(3, depth + 2));

          const rawTitle = typeof node.attrs.title === "string" ? node.attrs.title : "";
          const escapedTitle = rawTitle.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

          state.write(`${colons}kenote-section title="${escapedTitle}"\n\n`);
          state.renderContent(node);
          state.ensureNewLine();
          state.write(`${colons}`);
          state.closeBlock(node);

          state.sectionDepth = depth - 1;
        },
      },
    };
  },
});
