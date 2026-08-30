# Kenote 🚀

> A minimal, lightning-fast, local-first Raycast-inspired markdown note-taking app for Windows, macOS, and Linux built with **Tauri v2**, **React**, **TypeScript**, and **Tailwind CSS**.

<p align="center">
  <img src="src/assets/app-icon.png" width="128" height="128" alt="Kenote Icon" style="border-radius: 24px;" />
</p>

---

## ✨ Features

- 📝 **Live WYSIWYG Markdown Formatting**: Headings (`#`), bold (`**`), italics (`*`), strikethrough (`~~`), underline, quotes (`>`), and lists (`-`, `1.`, `[ ]`) render live as you type.
- 📌 **Always-On-Top Pinning**: Keep your notes floating over all active apps with a single click or `Ctrl + P`.
- 💾 **Local-First .md Storage**: Your notes belong to you - stored directly as standard `.md` markdown files on your local drive with instant auto-save.
- 🗂️ **Note Switcher & Fast Search**: Browse, filter, pin, and manage all your notes with `Ctrl + O`.
- ⚡ **Command Actions Palette**: Search all app actions with `Ctrl + K`.
- 🎨 **Custom Accent Theme & Gradients**: Default `#0399F7` Electric Blue theme with customizable gradients and color presets.
- 💻 **Syntax Highlighting & Copy Code**: Code blocks with automatic language detection and 1-click copy.
- 🔄 **Built-in Update Checking**: Automatically check for the latest releases from GitHub.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + N` | Create New Note |
| `Ctrl + O` | Browse Notes Switcher |
| `Ctrl + K` | Open Actions / Command Palette |
| `Ctrl + P` | Toggle Pin Always On Top |
| `Ctrl + ,` | Open Settings |
| `Ctrl + Shift + C` | Copy Note as Markdown |
| `Esc` | Close any open modal |

---

## 🛠️ Tech Stack

- **Desktop Core**: [Tauri v2](https://tauri.app) (Rust)
- **Frontend**: [React 18](https://react.dev), [TypeScript](https://www.typescriptlang.org), [Vite](https://vitejs.dev)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Rich Editor**: [Tiptap Editor](https://tiptap.dev) + [tiptap-markdown](https://github.com/hunghoang7300/tiptap-markdown)
- **Icons**: Lucide Icons & Custom Raycast SVG

---

## 🚀 Development & Build

### Prerequisites
- [Node.js](https://nodejs.org) (v18+) & [pnpm](https://pnpm.io)
- [Rust](https://rustup.rs)

### Install Dependencies
```bash
pnpm install
```

### Run in Development
```bash
pnpm tauri dev
```

### Build Production Executable / Installer
```bash
pnpm tauri build
```

The output installers (`.msi`, `.exe`, `.dmg`, `.deb`, `.AppImage`) will be generated in `src-tauri/target/release/bundle/`.

---

## 📄 License

MIT License (c) 2026 [yetemgetaB](https://github.com/yetemgetaB)
