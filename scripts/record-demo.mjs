import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DIST_DIR = path.resolve("dist");
const FRAMES_DIR = path.resolve("docs/demo-frames");
const OUTPUT_GIF = path.resolve("docs/screenshots/kenote-demo.gif");

if (!fs.existsSync(FRAMES_DIR)) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
} else {
  // clean old frames
  fs.readdirSync(FRAMES_DIR).forEach((f) => fs.unlinkSync(path.join(FRAMES_DIR, f)));
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

server.listen(4174, "127.0.0.1", async () => {
  console.log("Recording server running at http://127.0.0.1:4174");
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
      ],
    });

    const page = await browser.newPage();
    // 500x660 window at 1.5x scale (750x990) for clean proportions
    await page.setViewport({ width: 500, height: 660, deviceScaleFactor: 1.5 });

    await page.goto("http://127.0.0.1:4174", { waitUntil: "networkidle0" });

    await page.evaluate((notes, settings) => {
      localStorage.clear();
      localStorage.setItem("kenote_notes_mock", JSON.stringify(notes));
      localStorage.setItem("kenote_settings_mock", JSON.stringify(settings));
      localStorage.setItem("kenote_active_note_id", "welcome-v060");
      localStorage.setItem("has_seen_welcome_v1", "true");
    }, mockNotes, mockSettings);

    await page.reload({ waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));

    let frameIndex = 0;
    const client = await page.target().createCDPSession();
    await client.send("Page.startScreencast", {
      format: "png",
      quality: 85,
      everyNthFrame: 1,
    });

    client.on("Page.screencastFrame", async ({ data, sessionId }) => {
      const idx = String(frameIndex++).padStart(5, "0");
      fs.writeFileSync(path.join(FRAMES_DIR, `frame_${idx}.png`), Buffer.from(data, "base64"));
      try {
        await client.send("Page.screencastFrameAck", { sessionId });
      } catch {}
    });

    console.log("🎥 Starting deliberate, relaxed workflow recording...");

    // 1. Initial pause to take in the clean note layout
    await new Promise((r) => setTimeout(r, 1200));

    // 2. Click checkbox to toggle with relaxed pauses
    const checkbox = await page.$("li[data-checked] input[type='checkbox']");
    if (checkbox) {
      await checkbox.click();
      await new Promise((r) => setTimeout(r, 1000));
      await checkbox.click();
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 3. Fold and Unfold the Collapsible Section smoothly
    const chevron = await page.$("button[title*='Collapse'], [data-type='section'] button");
    if (chevron) {
      await chevron.click();
      await new Promise((r) => setTimeout(r, 1200));
      await chevron.click();
      await new Promise((r) => setTimeout(r, 1200));
    }

    // 4. Focus editor and trigger slash menu with comfortable pacing
    const editor = await page.$(".tiptap");
    if (editor) {
      await editor.click();
      await page.keyboard.down("Control");
      await page.keyboard.press("End");
      await page.keyboard.up("Control");
      await page.keyboard.press("Enter");
      await new Promise((r) => setTimeout(r, 600));

      await page.keyboard.type("/c", { delay: 250 });
      await new Promise((r) => setTimeout(r, 1200));

      // Arrow down through slash commands
      await page.keyboard.press("ArrowDown");
      await new Promise((r) => setTimeout(r, 800));
      await page.keyboard.press("ArrowDown");
      await new Promise((r) => setTimeout(r, 900));

      // Dismiss menu
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 700));
    }

    // 5. Trigger Quick Switcher HUD (Ctrl+Tab) with generous display time
    await page.keyboard.down("Control");
    await page.keyboard.press("Tab");
    await new Promise((r) => setTimeout(r, 1300));
    await page.keyboard.press("Tab");
    await new Promise((r) => setTimeout(r, 1300));
    await page.keyboard.up("Control");
    await new Promise((r) => setTimeout(r, 1600));

    // Stop screencast
    await client.send("Page.stopScreencast");
    console.log(`🎬 Captured ${frameIndex} frames!`);

    await browser.close();
    server.close();

    if (frameIndex > 5) {
      console.log("🎞️ Compiling frames into slower, ultra-smooth GIF using ffmpeg...");
      // Using 10 fps with setpts to give relaxed playback speed
      const ffmpegCmd = `ffmpeg -y -framerate 10 -i "${FRAMES_DIR}/frame_%05d.png" -filter_complex "[0:v] fps=10,scale=500:-1:flags=lanczos,split [a][b];[a] palettegen=max_colors=128:stats_mode=diff [p];[b][p] paletteuse=dither=bayer:bayer_scale=3" "${OUTPUT_GIF}"`;
      execSync(ffmpegCmd, { stdio: "inherit" });
      console.log("✅ High quality GIF successfully created:", OUTPUT_GIF);
    }
  } catch (err) {
    console.error("Recording error:", err);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
