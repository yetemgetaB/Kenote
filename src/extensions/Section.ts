import { Node, mergeAttributes } from "@tiptap/core";

export interface SectionOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    section: {
      /**
       * Set or insert a section block
       */
      setSection: (attributes?: { title?: string }) => ReturnType;
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
