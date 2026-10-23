# Changelog

All notable changes to **KeNote** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
