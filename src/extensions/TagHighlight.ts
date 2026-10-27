import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { TAG_PATTERN } from "../utils/tags.ts";

export const tagHighlightPluginKey = new PluginKey("tagHighlight");

export const TagHighlight = Extension.create({
  name: "tagHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: tagHighlightPluginKey,
        props: {
          decorations(state) {
            const { doc } = state;
            const decorations: Decoration[] = [];

            doc.descendants((node, pos, parent) => {
              // Ignore code blocks
              if (parent && parent.type.name === "codeBlock") {
                return false;
              }
              if (node.type.name === "codeBlock") {
                return false;
              }

              // Only inspect text nodes
              if (!node.isText || !node.text) {
                return;
              }

              // Ignore text with code mark
              if (node.marks.some((m) => m.type.name === "code")) {
                return;
              }

              const text = node.text;
              const regex = new RegExp(TAG_PATTERN.source, "g");
              let match: RegExpExecArray | null;

              while ((match = regex.exec(text)) !== null) {
                const fullMatch = match[0];
                const tagIdentifier = match[1];
                const hashIndex = fullMatch.indexOf("#");
                if (hashIndex === -1) continue;

                const start = pos + match.index + hashIndex;
                const end = start + 1 + tagIdentifier.length;

                decorations.push(
                  Decoration.inline(start, end, {
                    class: "kenote-tag-pill",
                    "data-tag": tagIdentifier.toLowerCase(),
                    title: `Tag: #${tagIdentifier.toLowerCase()} (Click to filter)`,
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },

          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement | null;
            const tagEl = target?.closest(".kenote-tag-pill") as HTMLElement | null;
            if (tagEl) {
              const tag = tagEl.getAttribute("data-tag");
              if (tag) {
                window.dispatchEvent(
                  new CustomEvent("kenote:open-tag", { detail: { tag } })
                );
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
