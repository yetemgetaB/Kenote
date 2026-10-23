import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const CalloutAlerts = Extension.create({
  name: "calloutAlerts",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("calloutAlerts"),
        props: {
          decorations(state) {
            const { doc } = state;
            const decorations: Decoration[] = [];

            doc.descendants((node, pos) => {
              if (node.type.name === "blockquote") {
                const firstChild = node.firstChild;
                if (firstChild && firstChild.isTextblock) {
                  const text = firstChild.textContent;
                  const match = text.match(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i);
                  if (match) {
                    const alertType = match[1].toLowerCase();

                    // Apply callout container styles and border
                    decorations.push(
                      Decoration.node(pos, pos + node.nodeSize, {
                        class: `kenote-callout kenote-callout-${alertType}`,
                        "data-alert": alertType,
                      })
                    );

                    // Style the [!TYPE] marker as an alert badge
                    const firstChildPos = pos + 1;
                    const tagStart = firstChildPos + text.indexOf(match[0]);
                    const tagEnd = tagStart + match[0].length;

                    decorations.push(
                      Decoration.inline(tagStart, tagEnd, {
                        class: `kenote-callout-badge kenote-callout-badge-${alertType}`,
                      })
                    );
                  }
                }
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
