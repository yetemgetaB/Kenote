import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DIST_DIR = path.resolve("dist");
const SCREENSHOTS_DIR = path.resolve("docs/screenshots");

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

const showcaseMarkdown = fs.readFileSync(path.resolve("docs/demo-notes/Kenote-Features-Showcase.md"), "utf-8");

const mockNotes = [
  {
    id: "welcome-v060",
    filename: "welcome-v060.md",
    title: "⚡ Welcome to KeNote v0.6.0",
    content: showcaseMarkdown,
    updated_at: Math.floor(Date.now() / 1000),
    created_at: Math.floor(Date.now() / 1000) - 86400,
    character_count: showcaseMarkdown.length,
    is_pinned: true,
  },
  {
    id: "project-roadmap",
    filename: "project-roadmap.md",
    title: "Project Roadmap & Architecture",
    content: "# Project Roadmap\n\n- [x] Tauri v2 migration\n- [x] Slash command palette\n- [ ] Multi-window sync",
    updated_at: Math.floor(Date.now() / 1000) - 3600,
    created_at: Math.floor(Date.now() / 1000) - 172800,
    character_count: 120,
    is_pinned: true,
  },
  {
    id: "sprint-tasks",
    filename: "sprint-tasks.md",
    title: "Weekly Sprint & Backlog",
    content: "# Sprint 42\n\n:::kenote-section title=\"Active Sprint\" color=\"purple\"\n- [x] Code signing\n- [ ] Performance profiling\n:::",
    updated_at: Math.floor(Date.now() / 1000) - 7200,
    created_at: Math.floor(Date.now() / 1000) - 259200,
    character_count: 95,
    is_pinned: false,
  },
  {
    id: "meeting-notes",
    filename: "meeting-notes.md",
    title: "Design Sync — UI Polish",
    content: "# Design Sync\n\n> Clean, quiet, and fast.\n\nKeep borders minimal and typography crisp.",
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 2,
    created_at: Math.floor(Date.now() / 1000) - 86400 * 3,
    character_count: 80,
    is_pinned: false,
  },
];

const mockSettings = {
  theme: "dark",
  accent_color: "#38BDF8",
  accent_name: "sky",
  font_family: "system-ui",
  font_size: "15px",
  line_height: "1.6",
  auto_save_interval: 500,
  always_on_top: false,
  quick_switcher_mode: "overlay",
  quick_switcher_order: "mru",
  quick_switcher_shortcut: "ctrl_tab",
  global_zoom: 100,
  editor_zoom: 100,
  global_shortcut: "Alt+Shift+K",
  has_completed_onboarding: true,
  startup_behavior: "specific",
  startup_specific_note_id: "welcome-v060",
  last_active_note_id: "welcome-v060",
  telemetry_enabled: false,
};

// Start simple static file server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/" || reqPath === "") reqPath = "/index.html";
  const filePath = path.join(DIST_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    const indexPath = path.join(DIST_DIR, "index.html");
    res.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream(indexPath).pipe(res);
  }
});

server.listen(4173, "127.0.0.1", async () => {
  console.log("Serving static build on http://127.0.0.1:4173");
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--font-render-hinting=max",
      ],
    });

    const page = await browser.newPage();
    // 540x720 window at 2x Retina scale (1080x1440 HiDPI)
    await page.setViewport({ width: 540, height: 720, deviceScaleFactor: 2 });

    // Navigate to initialize origin storage
    await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle0" });

    // Populate mock storage
    await page.evaluate((notes, settings) => {
      localStorage.clear();
      localStorage.setItem("kenote_notes_mock", JSON.stringify(notes));
      localStorage.setItem("kenote_settings_mock", JSON.stringify(settings));
      localStorage.setItem("kenote_active_note_id", "welcome-v060");
      localStorage.setItem("has_seen_welcome_v1", "true");
    }, mockNotes, mockSettings);

    // Reload with stored data
    await page.reload({ waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));

    console.log("📸 Capturing Hero Editor Preview...");
    const heroPath = path.join(SCREENSHOTS_DIR, "editor-preview.png");
    await page.screenshot({ path: heroPath, type: "png" });
    console.log("✓ Saved:", heroPath);

    // 2. Capture Note Switcher
    console.log("📸 Capturing Note Switcher...");
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyO");
    await page.keyboard.up("Control");
    await new Promise((r) => setTimeout(r, 600));
    const switcherPath = path.join(SCREENSHOTS_DIR, "note-switcher.png");
    await page.screenshot({ path: switcherPath, type: "png" });
    console.log("✓ Saved:", switcherPath);

    // Close Note Switcher
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 400));

    // 3. Capture Settings
    console.log("📸 Capturing Settings View...");
    await page.keyboard.down("Control");
    await page.keyboard.press("Comma");
    await page.keyboard.up("Control");
    await new Promise((r) => setTimeout(r, 600));
    const settingsPath = path.join(SCREENSHOTS_DIR, "settings-theme.png");
    await page.screenshot({ path: settingsPath, type: "png" });
    console.log("✓ Saved:", settingsPath);

    // Close Settings
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 400));

    // 4. Capture Slash Menu
    console.log("📸 Capturing Slash Menu...");
    const editorEl = await page.$(".tiptap");
    if (editorEl) {
      await editorEl.click();
      // Move to end of document
      await page.keyboard.down("Control");
      await page.keyboard.press("End");
      await page.keyboard.up("Control");
      await page.keyboard.press("Enter");
      await page.keyboard.type("/c");
      await new Promise((r) => setTimeout(r, 600));
      const slashPath = path.join(SCREENSHOTS_DIR, "slash-menu.png");
      await page.screenshot({ path: slashPath, type: "png" });
      console.log("✓ Saved:", slashPath);
    }

    // 5. Capture Quick Switcher HUD
    console.log("📸 Capturing Quick Switcher HUD...");
    // Clear slash menu
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 300));

    // Trigger Quick Switcher: Ctrl+Tab
    await page.keyboard.down("Control");
    await page.keyboard.press("Tab");
    await new Promise((r) => setTimeout(r, 600));
    const quickSwitcherPath = path.join(SCREENSHOTS_DIR, "quick-switcher.png");
    await page.screenshot({ path: quickSwitcherPath, type: "png" });
    console.log("✓ Saved:", quickSwitcherPath);
    await page.keyboard.up("Control");

    console.log("🎉 All screenshots captured successfully!");
  } catch (err) {
    console.error("Error capturing screenshots:", err);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
