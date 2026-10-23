import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";
import { wrapIn } from "@tiptap/pm/commands";

export interface SectionOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    section: {
      /**
       * Insert a new section at the current selection or block position
       */
      insertSection: (attributes?: { title?: string; color?: string; isCollapsed?: boolean }) => ReturnType;
      /**
       * Set or insert a section block
       */
      setSection: (attributes?: { title?: string; color?: string; isCollapsed?: boolean }) => ReturnType;
      /**
       * Collapse all sections across the entire document
       */
      collapseAllSections: () => ReturnType;
      /**
       * Expand all sections across the entire document
       */
      expandAllSections: () => ReturnType;
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

    // Extract attributes if present
    const afterKeyword = restOfLine.slice("kenote-section".length).trim();
    let title = "";
    const titleMatch = afterKeyword.match(/title="((?:[^"\\]|\\.)*)"/);
    if (titleMatch) {
      title = titleMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }

    let color = "default";
    const colorMatch = afterKeyword.match(/color="((?:[^"\\]|\\.)*)"/);
    if (colorMatch) {
      color = colorMatch[1];
    }

    let isCollapsed = false;
    const collapsedMatch = afterKeyword.match(/isCollapsed="(true|false)"/);
    if (collapsedMatch) {
      isCollapsed = collapsedMatch[1] === "true";
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
      ["data-color", color],
      ["data-collapsed", isCollapsed ? "true" : "false"],
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

  isolating: true,

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
      isCollapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-collapsed") === "true",
        renderHTML: (attributes) => ({
          "data-collapsed": attributes.isCollapsed ? "true" : "false",
        }),
      },
      color: {
        default: "default",
        parseHTML: (element) => element.getAttribute("data-color") || "default",
        renderHTML: (attributes) => ({
          "data-color": attributes.color || "default",
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
          const color = attributes?.color ?? "default";
          const isCollapsed = Boolean(attributes?.isCollapsed);
          const sectionType = this.type;
          const paragraphType = state.schema.nodes.paragraph;

          if (!paragraphType) {
            return false;
          }

          // If text or blocks are currently selected, wrap them into a section
          if (!state.selection.empty) {
            const wrap = wrapIn(sectionType, { title, color, isCollapsed, _autoFocus: true });
            if (wrap(state, dispatch)) {
              return true;
            }
          }

          // Create a valid section node containing one empty paragraph
          const sectionNode = sectionType.create(
            { title, color, isCollapsed, _autoFocus: true },
            paragraphType.create()
          );

          if (!sectionNode) {
            return false;
          }

          if (dispatch) {
            const { selection } = state;
            const { $from } = selection;

            // If current block is an empty paragraph, replace it directly (works both at root level and nested inside another section!)
            const isEmptyParagraph =
              $from.parent.type === paragraphType &&
              $from.parent.content.size === 0;

            if (isEmptyParagraph) {
              const fromPos = $from.before();
              const toPos = $from.after();
              tr.replaceWith(fromPos, toPos, sectionNode);
              const resolved = tr.doc.resolve(fromPos + 1);
              tr.setSelection(Selection.near(resolved));
            } else {
              // Insert after current block at selection depth (so if inside a section, it inserts inside that section)
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
      collapseAllSections:
        () =>
        ({ tr, state, dispatch }) => {
          let modified = false;
          state.doc.descendants((node, pos) => {
            if (node.type === this.type && !node.attrs.isCollapsed) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, isCollapsed: true });
              modified = true;
            }
          });
          if (modified && dispatch) {
            dispatch(tr);
          }
          return modified;
        },
      expandAllSections:
        () =>
        ({ tr, state, dispatch }) => {
          let modified = false;
          state.doc.descendants((node, pos) => {
            if (node.type === this.type && node.attrs.isCollapsed) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, isCollapsed: false });
              modified = true;
            }
          });
          if (modified && dispatch) {
            dispatch(tr);
          }
          return modified;
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
          const parentDepth = sectionDepth - 1;
          const isAtParentEnd = sectionAfterPos >= $from.end(parentDepth);

          if (isAtParentEnd) {
            const paragraphType = state.schema.nodes.paragraph;
            if (paragraphType && dispatch) {
              const tr = state.tr.insert(sectionAfterPos, paragraphType.create());
              tr.setSelection(Selection.near(tr.doc.resolve(sectionAfterPos + 1)));
              dispatch(tr.scrollIntoView());
              return true;
            }
          } else if (dispatch) {
            const $after = state.doc.resolve(sectionAfterPos);
            const sel =
              Selection.findFrom($after, 1) ||
              Selection.near(state.doc.resolve(Math.min(state.doc.content.size, sectionAfterPos + 1)));
            if (sel) {
              const tr = state.tr.setSelection(sel);
              dispatch(tr.scrollIntoView());
              return true;
            }
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
          const parentDepth = sectionDepth - 1;
          const isAtParentStart = sectionBeforePos <= $from.start(parentDepth);

          if (isAtParentStart) {
            const paragraphType = state.schema.nodes.paragraph;
            if (paragraphType && dispatch) {
              const tr = state.tr.insert(sectionBeforePos, paragraphType.create());
              tr.setSelection(Selection.near(tr.doc.resolve(sectionBeforePos + 1)));
              dispatch(tr.scrollIntoView());
              return true;
            }
          } else if (dispatch) {
            const $before = state.doc.resolve(sectionBeforePos);
            const sel =
              Selection.findFrom($before, -1) ||
              Selection.near(state.doc.resolve(Math.max(0, sectionBeforePos - 1)));
            if (sel) {
              const tr = state.tr.setSelection(sel);
              dispatch(tr.scrollIntoView());
              return true;
            }
          }

          return false;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-s": () => this.editor.commands.insertSection(),
      "Mod-Shift-S": () => this.editor.commands.insertSection(),
      "Mod-Alt-[": () => this.editor.commands.collapseAllSections(),
      "Mod-Alt-]": () => this.editor.commands.expandAllSections(),
      Enter: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;

        let insideSection = false;
        let isSpecialBlock = false;
        for (let d = $from.depth; d > 0; d--) {
          const nodeName = $from.node(d).type.name;
          if (nodeName === "taskItem" || nodeName === "codeBlock") {
            isSpecialBlock = true;
          }
          if ($from.node(d).type === this.type) {
            insideSection = true;
            break;
          }
        }

        if (!insideSection || isSpecialBlock) {
          return false;
        }

        return this.editor.commands.splitBlock();
      },
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
          const colorAttr = node.attrs.color && node.attrs.color !== "default" ? ` color="${node.attrs.color}"` : "";
          const collapsedAttr = node.attrs.isCollapsed ? ` isCollapsed="true"` : "";

          state.write(`${colons}kenote-section title="${escapedTitle}"${colorAttr}${collapsedAttr}\n\n`);
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
