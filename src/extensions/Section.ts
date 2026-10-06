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
});
