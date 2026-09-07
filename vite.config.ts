import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: false,
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("highlight.js") || id.includes("lowlight")) {
              return "vendor-highlight";
            }
            if (id.includes("@tiptap") || id.includes("prosemirror") || id.includes("tiptap-markdown")) {
              return "vendor-editor";
            }
            if (id.includes("react") || id.includes("posthog")) {
              return "vendor-core";
            }
          }
        },
      },
    },
  },
});
