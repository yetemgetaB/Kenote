# Changelog

All notable changes to **KeNote** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.6.5] - 2026-10-29

### ✨ New Features & Polish

#### 🔍 In-Note Find & Replace (`Ctrl + F` / `Ctrl + H`)
- **Raycast-Styled Floating HUD (`FindReplaceBar`)**: Compact top-right floating bar with live match counter (`1 of 5`), previous/next navigation buttons, and expand/collapse Replace row.
- **ProseMirror Search Engine**: Live match ranges and decorations highlighting all matches in amber and active match in vibrant orange with viewport auto-scroll.
- **Match Options**: Case sensitive (`Aa`) and whole-word (`\b`) toggle buttons for precision searching.
- **Instant Replacement**: 1-click single replace (`Ctrl + Shift + Enter`) and reverse-order Replace All preserving document positions.
- **Keyboard Shortcuts & Command Palette**: <kbd>Ctrl</kbd> + <kbd>F</kbd> for Find, <kbd>Ctrl</kbd> + <kbd>H</kbd> for Replace, <kbd>Enter</kbd> / <kbd>Shift + Enter</kbd> for navigation, and Command Palette integration.

#### 🏷️ Note Tags & Categorization (`#tag`)
- **Zero-Syntax-Pollution Inline Tags**: Write tags anywhere in your notes (e.g. `#work`, `#ideas`, `#project-2026`, `#dev/react`); they stay pure Markdown in raw files while rendering with interactive accent badge styling in the editor.
- **Fast Rust & Frontend Parsing**: Automatic tag extraction in the Rust backend (`NoteMetadata.tags`) and client state with smart exclusions for headings (`# Title`), URLs, issue numbers, and code blocks.
- **Note Switcher Filter Pills**: Dynamic horizontal filter pill bar (`All`, `#work (5)`, `#ideas (3)`) in the Note Switcher with live note counts.
- **1-Click Tag Filtering**: Click any inline tag pill in the editor or note card badge in search lists to instantly filter notes by that tag.
- **Command Palette & Quick Switcher Badges**: Search notes by `#tag` and view active tag badges across all switcher overlays.

---

## [0.6.4] - 2026-10-26

### ✨ New Features & Polish

#### 📤 Document Export Suite (PDF, HTML, Markdown, Rich Text)
- **PDF Document Export (`.pdf`)**: Print or save note directly to PDF with clean document layout and typography (`@media print` stylesheet with UI chrome hidden, proper page breaks, and high-contrast text).
- **Standalone HTML Page (`.html`)**: Export to a self-contained `.html` document with embedded dark/light mode responsive styles, system typography, and styled code blocks/tables.
- **Markdown & Plain Text (`.md`, `.txt`)**: Export active note via native save file dialog (`api.saveFile`) with proper file extension filters.
- **Copy Formatted Rich Text (`Ctrl + C` / Menu)**: Copy styled HTML content directly to clipboard with plain text fallback, ready to paste into Slack, Gmail, or Google Docs.
- **Export All Notes (Vault Backup)**: One-click directory backup of the entire notes collection into Markdown files in a chosen folder.
- **Raycast-Styled Export HUD (`ExportModal`)**: Fast modal accessible via `Ctrl + Shift + E`, titlebar icon button, or Command Palette, with keyboard navigation (`↑`/`↓`) and hotkey shortcuts (`P`, `C`, `H`, `M`, `T`, `B`).

#### 🖼️ Image Attachments, Clipboard Pasting & Drag-and-Drop
- **Instant Clipboard Image Pasting (`Ctrl + V`)**: Copy screenshots or web images directly into notes; KeNote automatically writes them to your note's local `assets/` directory and embeds them seamlessly.
- **Drag-and-Drop Files (DND)**: Drop images directly from Windows Explorer, Finder, or desktop into the editor at your cursor position with an active visual drop target indicator.
- **Slash Command & Toolbar Access**: Type `/image` or click the new image icon in the bottom toolbar to pick and attach images via native file dialog.
- **100% Portable Markdown**: Persisted as clean relative paths (`![caption](assets/image-...png)`), fully compatible with Obsidian, VS Code, Typora, and GitHub.
- **Interactive Image Card**:
  - **Zoom Lightbox Preview**: Click any image or hit the search icon to view full-resolution in a modal.
  - **Copy Image**: 1-click clipboard copy of raw image bytes for sharing in external apps.
  - **Editable Captions**: Inline alt-text / caption pill synced directly with markdown.
  - **Error & Loading States**: Clean skeleton loader and broken link fallback with 1-click deletion.
- **Security & Integrity**: Hardened Rust backend with strict directory traversal prevention and extension validation.

---

## [0.6.3] - 2026-10-25

### ✨ New Features & Polish
- **Markdown Tables**: Added 3x3 table insertion via `/table` slash command, bottom toolbar, and contextual row/column controls.
- **Editor Navigation Fixes**: Enhanced code block arrow navigation, enter behavior, and flushSync cleanup.

---

## [0.6.2] - 2026-10-24

### ✨ New Features & Polish

#### 💻 Smart Code Blocks & Syntax Coloring
- **Vibrant Syntax Highlighting**: Added Tokyo Night / Atom One Dark color palette for code blocks supporting dozens of programming languages (keywords, strings, functions, classes, comments, numbers, types).
- **Smart 4-Space Indentation Rules**:
  - `Tab`: Indents cursor or multi-line selections by 4 spaces.
  - `Shift+Tab`: Dedents cursor line or selected lines by up to 4 spaces without destroying text.
  - `Enter` Auto-Indentation: Preserves base indentation on new lines automatically.
  - **Block Opener Indentation**: Automatically increases indentation by +4 spaces when pressing `Enter` after block openers (`:`, `{`, `[`, `(`) for Python `if`/`def`/`class`, JavaScript, TypeScript, Rust, and C/C++.
  - **Bracket Expansion**: Pressing `Enter` between `{}` cleanly expands into a 3-line block with an indented center line and correctly positioned cursor.
  - **Smart Backspace**: Deletes full 4-space indent units when deleting at indentation boundaries.

#### ⚡ Smooth Startup & Zero Flash
- **Eliminated White Screen Delay**: Resolved startup white screen flash by configuring window background color and synchronizing Tauri window presentation with DOM readiness.
- **Seamless Window Positioning**: Saved position is applied before showing the window, completely removing launch position jump and reposition jitter.

#### 🏷️ Callout Alert Badge Fix
- **Clean Alert Badges**: Resolved rendering glitch where raw bracket symbols (`[!NOTE]`) were visible and clipped in note callouts.

---

## [0.6.1] - 2026-10-24

### 🐛 Bug Fixes & Improvements

#### ⌨️ Global Launcher Shortcut Reliability
- **Windows Extended Key Fix (`F13`–`F24` & Custom Hotkeys)**: Deferred global hotkey registration to ensure the Windows message loop is active before registering hooks, resolving issues where custom shortcuts like `Ctrl+Alt+F13` failed to trigger.
- **Eliminated Silent Fallback**: Removed the silent fallback that secretly reverted to `Alt+Shift+K` when a custom shortcut encountered startup timing delays, preventing split-brain mismatch between UI settings and active OS hooks.
- **Ergonomic Default Hotkey (`Ctrl+Space`)**: Updated the default global launch shortcut from `Alt+Shift+K` to `Ctrl+Space` for a faster, Raycast-inspired workflow across all platforms.

---

## [0.6.0] - 2026-10-24

### 🚀 Highlights
KeNote `v0.6.0` is a major feature release introducing **Collapsible Stacks (Sections)** with custom color themes, **Offline Spellcheck & Quick Suggestions**, an **Expanded Slash Command Suite**, and live **GitHub-Style Callout Alerts**.

---

### ✨ New Features

#### 🗂️ Collapsible Stacks (Sections)
- **Instant Stack Creation**: Create structured, collapsible blocks via the toolbar icon, `/stack` slash command, or `Ctrl+Shift+S`.
- **Selection Wrapping**: Select any amount of text and wrap it directly into a stack with `Ctrl+Shift+S` or toolbar action.
- **Inline Title Pill**: Typing `/stack [title]` renders an interactive argument pill to customize stack titles without disrupting typing flow.
- **6 Accent Color Themes**: Choose from *Default (Slate)*, *Blue*, *Emerald*, *Amber*, *Purple*, and *Rose* with customized left borders, header gradient tints, and chevron accents.
- **Stack Context Menu (`···`)**:
  - **Duplicate Stack**: Clones the stack and its full contents immediately below.
  - **Unwrap Stack**: Dissolves the container and lifts the internal content into the parent note seamlessly.
  - **Copy Markdown & Plain Text**: Fast clipboard copying of stack contents.
  - **Delete Stack**: Safely removes the stack.
- **Bulk Collapse & Expand**:
  - **Collapse All Stacks**: `Ctrl + Alt + [`
  - **Expand All Stacks**: `Ctrl + Alt + ]`
  - Accessible via global shortcuts, the Stack `···` menu, and the Command Palette (`Ctrl + K`).
- **Smooth Keyboard Navigation**: Fluid arrow key traversal across section boundaries and nested stack hierarchies.
- **Standard Markdown Persistence**: Sections persist cleanly as `:::kenote-section title="..." color="..." isCollapsed="true"` for 100% portable notes.

#### ✍️ Offline Spellcheck & Context Menu
- **Built-in Offline Dictionary**: Morphologically aware English lexicon (handles plurals, conjugations, possessives).
- **Typo Correction Engine**: Damerau-Levenshtein distance algorithm surfaces high-accuracy suggestions for misspellings.
- **Right-Click Word Auto-Selection**: Right-clicking any word selects it automatically and shows top correction candidates for 1-click replacement.
- **User Dictionary Support**: "Add to Dictionary" allows teaching KeNote custom jargon, technical terms, and names.
- **Refined Context Menu Design**: Stripped out distracting animations and sparkles for a sleek, distraction-free native feel.

#### ⚡ Slash Commands & Markdown Callouts
- **Numbered Lists**: Quickly insert ordered lists via `/numbered` or `/1.`.
- **Date & Time Suite**:
  - `/today`: Inserts current date (`DD/MM/YYYY`).
  - `/tomorrow` & `/yesterday`: Relative date shortcuts.
  - `/time`: Inserts current time (`HH:mm:ss`).
  - `/now`: Inserts full timestamp (`DD/MM/YYYY HH:mm`).
- **GitHub-Style Callout Alerts**:
  - Interactive decorations for `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, and `> [!CAUTION]`.
  - Color-coded badges and icons that render in real-time while editing.
- **Viewport Boundary Awareness**: Menus intelligently anchor upwards when invoked near the bottom of the screen.

---

### 🧪 Test & Reliability Enhancements
- **265 Automated Tests**: Comprehensive unit test coverage across node schemas, markdown serialization roundtrips, keyboard shortcuts, spellchecking, and telemetry allowlists.
- **Strict Privacy Contract**: Verified telemetry event and command action allowlists protecting user data.

---

## [0.5.7] - 2026-09-27
- Enhanced Windows startup and background readiness.
- Improved single-instance window focus restoration.

## [0.5.0] - 2026-08-15
- Note switcher enhancements and quick switcher search.
- Window pin / unpin controls.
- Global launch shortcut integration.
