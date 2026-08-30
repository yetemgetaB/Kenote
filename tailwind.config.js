/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "var(--bg-main)",
          subtle: "var(--bg-subtle)",
          card: "var(--bg-card)",
          hover: "var(--bg-hover)",
          active: "var(--bg-active)",
        },
        border: {
          DEFAULT: "var(--border-color)",
          subtle: "var(--border-subtle)",
        },
        accent: {
          DEFAULT: "var(--accent-color)",
          hover: "var(--accent-hover)",
          muted: "var(--accent-muted)",
          glow: "var(--accent-glow)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        }
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif"
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Cascadia Code",
          "Consolas",
          "monospace"
        ]
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      }
    },
  },
  plugins: [],
}
