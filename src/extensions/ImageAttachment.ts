import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { api } from "../utils/tauriBridge.ts";

export interface ImageAttachmentOptions {
  HTMLAttributes: Record<string, any>;
  onImageInserted?: (src: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    image: {
      /**
       * Add an image
       */
      setImage: (options: { src: string; alt?: string; title?: string }) => ReturnType;
    };
  }
}

export const ImageAttachmentPluginKey = new PluginKey("imageAttachmentHandler");

export const ImageAttachment = Node.create<ImageAttachmentOptions>({
  name: "image",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: "block",
  inline: false,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const alt = state.esc(node.attrs.alt || "");
          const src = state.esc(node.attrs.src || "");
          const title = node.attrs.title ? ` "${state.esc(node.attrs.title)}"` : "";
          state.write(`![${alt}](${src}${title})`);
          state.closeBlock(node);
        },
        parse: {
          // Handled by default markdown-it parser
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: ImageAttachmentPluginKey,
        props: {
          handlePaste(view, event) {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            const files = Array.from(clipboardData.files || []);
            let imageFiles = files.filter((f) => f.type.startsWith("image/"));

            if (imageFiles.length === 0 && clipboardData.items) {
              const items = Array.from(clipboardData.items);
              imageFiles = items
                .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
                .map((item) => item.getAsFile())
                .filter(Boolean) as File[];
            }

            if (imageFiles.length === 0) {
              return false;
            }

            event.preventDefault();

            // Process image file attachments asynchronously
            for (const file of imageFiles) {
              api
                .saveImageAttachment(file)
                .then((relPath) => {
                  const node = view.state.schema.nodes.image.create({
                    src: relPath,
                    alt: file.name.replace(/\.[^/.]+$/, ""),
                  });
                  const tr = view.state.tr.replaceSelectionWith(node);
                  view.dispatch(tr);
                })
                .catch((err) => {
                  console.error("Failed to save pasted image attachment:", err);
                });
            }

            return true;
          },

          handleDrop(view, event, _slice, moved) {
            if (moved) return false;

            const dataTransfer = event.dataTransfer;
            if (!dataTransfer || !dataTransfer.files || dataTransfer.files.length === 0) {
              return false;
            }

            const files = Array.from(dataTransfer.files);
            const imageFiles = files.filter(
              (f) =>
                f.type.startsWith("image/") ||
                /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(f.name)
            );

            if (imageFiles.length === 0) {
              return false;
            }

            event.preventDefault();

            let insertPos = view.state.selection.from;
            try {
              if (typeof view.posAtCoords === "function") {
                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (coordinates && typeof coordinates.pos === "number") {
                  insertPos = coordinates.pos;
                }
              }
            } catch {
              insertPos = view.state.selection.from;
            }

            for (const file of imageFiles) {
              api
                .saveImageAttachment(file)
                .then((relPath) => {
                  const node = view.state.schema.nodes.image.create({
                    src: relPath,
                    alt: file.name.replace(/\.[^/.]+$/, ""),
                  });
                  const tr = view.state.tr.insert(insertPos, node);
                  view.dispatch(tr);
                })
                .catch((err) => {
                  console.error("Failed to save dropped image attachment:", err);
                });
            }

            return true;
          },
        },
      }),
    ];
  },
});
