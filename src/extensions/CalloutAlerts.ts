import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const ALERT_LABELS: Record<string, string> = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
  important: "Important",
  caution: "Caution",
};

const ALERT_ICONS: Record<string, string> = {
  note: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="kenote-callout-icon"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  tip: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="kenote-callout-icon"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
  warning: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="kenote-callout-icon"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  important: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="kenote-callout-icon"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  caution: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="kenote-callout-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
};

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

                    // Compute exact position offsets within the text block
                    // pos is blockquote start, pos + 1 is paragraph start, pos + 2 is paragraph text content start
                    const trimmedMatch = match[0].trim();
                    const matchOffset = text.indexOf(trimmedMatch);
                    const tagStart = pos + 2 + matchOffset;
                    const tagEnd = tagStart + trimmedMatch.length;

                    // Render clean, symbol-free callout badge widget with icon and label
                    decorations.push(
                      Decoration.widget(
                        tagStart,
                        () => {
                          const badge = document.createElement("span");
                          badge.className = `kenote-callout-badge kenote-callout-badge-${alertType}`;
                          badge.setAttribute("contenteditable", "false");
                          const iconHtml = ALERT_ICONS[alertType] || "";
                          const label = ALERT_LABELS[alertType] || alertType.toUpperCase();
                          badge.innerHTML = `${iconHtml}<span class="kenote-callout-label">${label}</span>`;
                          return badge;
                        },
                        { side: -1 }
                      )
                    );

                    // Hide raw markdown [!TYPE] syntax symbols
                    decorations.push(
                      Decoration.inline(tagStart, tagEnd, {
                        class: "kenote-callout-raw-tag",
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
