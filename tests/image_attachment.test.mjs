import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body><div id='editor'></div></body></html>", {
  url: "http://localhost",
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
globalThis.Node = dom.window.Node;
globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Event = dom.window.Event;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.FileReader = dom.window.FileReader;

const StarterKit = (await import("@tiptap/starter-kit")).default;
const { Editor } = await import("@tiptap/core");
const { Markdown } = await import("tiptap-markdown");
const { ImageAttachment, ImageAttachmentPluginKey } = await import("../src/extensions/ImageAttachment.ts");
const { api, blobToBase64 } = await import("../src/utils/tauriBridge.ts");

function createImageEditor(initialContent = "<p>Initial paragraph</p>") {
  return new Editor({
    extensions: [
      StarterKit,
      ImageAttachment,
      Markdown.configure({
        html: true,
      }),
    ],
    content: initialContent,
  });
}

describe("Image Attachment & Clipboard/DND Feature Tests", () => {
  describe("1. Image Node Schema & Attributes", () => {
    it("creates an image node with src, alt, and title attributes", () => {
      const editor = createImageEditor("<p>Hello world</p>");

      editor.commands.setImage({
        src: "assets/diagram.png",
        alt: "System Architecture",
        title: "Diagram v1",
      });

      const html = editor.getHTML();
      assert.ok(html.includes("<img"), "HTML should contain an <img> element");
      assert.ok(html.includes('src="assets/diagram.png"'), "HTML should retain relative src");
      assert.ok(html.includes('alt="System Architecture"'), "HTML should retain alt attribute");

      editor.destroy();
    });

    it("serializes image node to standard Markdown syntax", () => {
      const editor = createImageEditor("<p>Text before</p>");

      editor.commands.setImage({
        src: "assets/screenshot-20261026.png",
        alt: "My Screenshot",
      });

      const md = editor.storage.markdown.getMarkdown();
      assert.ok(
        md.includes("![My Screenshot](assets/screenshot-20261026.png)"),
        `Markdown must match standard format, received: ${md}`
      );

      editor.destroy();
    });

    it("round-trips parsed Markdown into an image node", () => {
      const initialMd = "# Note Title\n\n![Pasted Diagram](assets/pasted-123.png)\n\nParagraph text.";
      const editor = new Editor({
        extensions: [
          StarterKit,
          ImageAttachment,
          Markdown.configure({ html: true }),
        ],
        content: initialMd,
      });

      let foundImage = false;
      editor.state.doc.descendants((node) => {
        if (node.type.name === "image") {
          foundImage = true;
          assert.equal(node.attrs.src, "assets/pasted-123.png");
          assert.equal(node.attrs.alt, "Pasted Diagram");
        }
      });

      assert.ok(foundImage, "Editor must parse markdown image into an image node");

      const roundTripMd = editor.storage.markdown.getMarkdown();
      assert.ok(roundTripMd.includes("![Pasted Diagram](assets/pasted-123.png)"));

      editor.destroy();
    });
  });

  describe("2. Tauri Bridge & Mock Attachment Storage", () => {
    it("saves an image attachment and returns relative assets path", async () => {
      const fakeBlob = new dom.window.Blob(["fake image content"], { type: "image/png" });
      const relPath = await api.saveImageAttachment(fakeBlob, "test-flow.png");

      assert.ok(relPath.startsWith("assets/"), "Must return relative assets/ path");
      assert.ok(relPath.includes("test-flow.png"), "Must include preferred file name");

      const resolved = await api.resolveAssetUrl(relPath);
      assert.ok(resolved.startsWith("data:"), "Resolved URL should return a data URI in mock mode");
    });

    it("passes external HTTP/HTTPS and Data URLs through untouched", async () => {
      const httpsUrl = "https://example.com/photo.jpg";
      const resolvedHttps = await api.resolveAssetUrl(httpsUrl);
      assert.equal(resolvedHttps, httpsUrl);

      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const resolvedData = await api.resolveAssetUrl(dataUrl);
      assert.equal(resolvedData, dataUrl);
    });
  });

  describe("3. Clipboard Paste Interception", () => {
    it("intercepts paste event when clipboard contains an image file", () => {
      const editor = createImageEditor("<p>Ready</p>");
      const plugin = ImageAttachmentPluginKey.get(editor.state);
      assert.ok(plugin, "ImageAttachment plugin must be registered on state");

      const mockImageFile = new dom.window.File(["sample image bytes"], "clip.png", { type: "image/png" });

      const mockEvent = {
        clipboardData: {
          files: [mockImageFile],
          items: [],
        },
        preventDefault() {
          this.defaultPrevented = true;
        },
        defaultPrevented: false,
      };

      const handled = plugin.props.handlePaste(editor.view, mockEvent, null);
      assert.equal(handled, true, "Must return true to signal paste was handled");
      assert.equal(mockEvent.defaultPrevented, true, "Must call preventDefault on paste event");

      editor.destroy();
    });

    it("ignores non-image paste events and allows default handling", () => {
      const editor = createImageEditor("<p>Ready</p>");
      const plugin = ImageAttachmentPluginKey.get(editor.state);

      const mockEvent = {
        clipboardData: {
          files: [],
          items: [
            {
              kind: "string",
              type: "text/plain",
            },
          ],
        },
        preventDefault() {
          this.defaultPrevented = true;
        },
        defaultPrevented: false,
      };

      const handled = plugin.props.handlePaste(editor.view, mockEvent, null);
      assert.equal(handled, false, "Must return false for non-image paste");
      assert.equal(mockEvent.defaultPrevented, false, "Must not preventDefault for text paste");

      editor.destroy();
    });
  });

  describe("4. Drag and Drop File Interception", () => {
    it("intercepts drop event when dropping image files", () => {
      const editor = createImageEditor("<p>Drop target</p>");
      const plugin = ImageAttachmentPluginKey.get(editor.state);

      const mockDroppedFile = new dom.window.File(["sample image bytes"], "drop.png", { type: "image/png" });

      const mockEvent = {
        clientX: 100,
        clientY: 100,
        dataTransfer: {
          files: [mockDroppedFile],
        },
        preventDefault() {
          this.defaultPrevented = true;
        },
        defaultPrevented: false,
      };

      const handled = plugin.props.handleDrop(editor.view, mockEvent, null, false);
      assert.equal(handled, true, "Must return true to signal drop was handled");
      assert.equal(mockEvent.defaultPrevented, true, "Must call preventDefault on drop event");

      editor.destroy();
    });

    it("ignores internal drag moves within document", () => {
      const editor = createImageEditor("<p>Move target</p>");
      const plugin = ImageAttachmentPluginKey.get(editor.state);

      const mockEvent = {
        dataTransfer: { files: [] },
      };

      const handled = plugin.props.handleDrop(editor.view, mockEvent, null, true);
      assert.equal(handled, false, "Must return false when moved is true");

      editor.destroy();
    });
  });
});
