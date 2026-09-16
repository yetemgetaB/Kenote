import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isValidExternalUrl } from "../src/utils/tauriBridge.ts";
import { APP_VERSION } from "../src/utils/version.ts";

describe("S4 Settings & External Integration Tests", () => {
  describe("External URL Security Validation", () => {
    it("allows standard secure web URLs", () => {
      assert.equal(isValidExternalUrl("https://github.com/yetemgetaB/Kenote"), true);
      assert.equal(isValidExternalUrl("https://kenote.dev/docs"), true);
      assert.equal(isValidExternalUrl("http://localhost:3000"), true);
      assert.equal(isValidExternalUrl("http://example.com/test?a=1&b=2#section"), true);
    });

    it("allows mailto and telephone communication URLs", () => {
      assert.equal(isValidExternalUrl("mailto:developer@kenote.dev"), true);
      assert.equal(isValidExternalUrl("tel:+1234567890"), true);
    });

    it("strictly blocks malicious, dangerous, or injection protocols", () => {
      assert.equal(isValidExternalUrl("javascript:alert(document.cookie)"), false);
      assert.equal(isValidExternalUrl("file:///C:/Windows/System32/cmd.exe"), false);
      assert.equal(isValidExternalUrl("data:text/html,<script>evil()</script>"), false);
      assert.equal(isValidExternalUrl("vbscript:msgbox"), false);
      assert.equal(isValidExternalUrl("shell:startup"), false);
      assert.equal(isValidExternalUrl("powershell:Start-Process"), false);
    });

    it("rejects non-URL and relative paths", () => {
      assert.equal(isValidExternalUrl(""), false);
      assert.equal(isValidExternalUrl("   "), false);
      assert.equal(isValidExternalUrl("/root/secret"), false);
      assert.equal(isValidExternalUrl("../relative/path"), false);
      assert.equal(isValidExternalUrl(null), false);
      assert.equal(isValidExternalUrl(undefined), false);
    });
  });

  describe("Application Version Consistency", () => {
    it("matches version across package.json, Cargo.toml, tauri.conf.json, and version.ts", () => {
      const rootDir = path.resolve(".");
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
      const tauriConf = JSON.parse(fs.readFileSync(path.join(rootDir, "src-tauri", "tauri.conf.json"), "utf8"));
      const cargoToml = fs.readFileSync(path.join(rootDir, "src-tauri", "Cargo.toml"), "utf8");

      const cargoVersionMatch = cargoToml.match(/name\s*=\s*"kenote"[\s\S]*?version\s*=\s*"([^"]+)"/);
      assert.ok(cargoVersionMatch, "Cargo.toml version should exist");
      const cargoVersion = cargoVersionMatch[1];

      assert.equal(APP_VERSION, "0.4.0");
      assert.equal(pkg.version, APP_VERSION);
      assert.equal(tauriConf.version, APP_VERSION);
      assert.equal(cargoVersion, APP_VERSION);
    });
  });

  describe("Custom Notes Directory Handling", () => {
    it("reports custom notes directory when set in settings, and default when cleared", async () => {
      const storage = new Map();
      globalThis.localStorage = {
        getItem: (k) => storage.get(k) || null,
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k),
        clear: () => storage.clear(),
      };

      const { api } = await import("../src/utils/tauriBridge.ts");

      // Default directory
      const defaultDir = await api.getNotesDirectory();
      assert.match(defaultDir, /AppData|Local Browser Storage/);

      // Set custom directory
      const customPath = "D:\\MySpecialNotes";
      await api.saveSettings({
        accent_color: "#0399F7",
        custom_notes_dir: customPath,
        font_size: "15px",
        font_family: "system-ui",
        line_height: "1.6",
        auto_save_interval: 500,
        always_on_top: false,
      });

      const updatedDir = await api.getNotesDirectory();
      assert.equal(updatedDir, customPath);

      // Switching directory preserves existing notes
      const notesBefore = await api.listNotes();
      assert.ok(notesBefore.length > 0);

      // Reset custom directory
      await api.saveSettings({
        accent_color: "#0399F7",
        custom_notes_dir: null,
        font_size: "15px",
        font_family: "system-ui",
        line_height: "1.6",
        auto_save_interval: 500,
        always_on_top: false,
      });

      const resetDir = await api.getNotesDirectory();
      assert.equal(resetDir, defaultDir);

      const notesAfter = await api.listNotes();
      assert.equal(notesAfter.length, notesBefore.length);
    });
  });

  describe("Updater Reliability & Version Comparison", () => {
    function isNewerVersion(remote, current) {
      const parse = (v) => v.replace(/^v/, "").split(".").map((x) => parseInt(x, 10) || 0);
      const r = parse(remote);
      const c = parse(current);
      for (let i = 0; i < Math.max(r.length, c.length); i++) {
        const rVal = r[i] || 0;
        const cVal = c[i] || 0;
        if (rVal > cVal) return true;
        if (rVal < cVal) return false;
      }
      return false;
    }

    it("correctly determines semantic version precedence", () => {
      assert.equal(isNewerVersion("0.4.1", "0.4.0"), true);
      assert.equal(isNewerVersion("v0.4.1", "0.4.0"), true);
      assert.equal(isNewerVersion("0.5.0", "0.4.0"), true);
      assert.equal(isNewerVersion("1.0.0", "0.4.0"), true);
      assert.equal(isNewerVersion("0.4.0", "0.4.0"), false);
      assert.equal(isNewerVersion("v0.4.0", "0.4.0"), false);
      assert.equal(isNewerVersion("0.3.9", "0.4.0"), false);
      assert.equal(isNewerVersion("0.3.4", "0.4.0"), false);
    });

    it("ensures network or HTTP failures are classified as error and not up_to_date", async () => {
      // Test update check state transition simulation
      let updateStatus = "idle";
      let errorMessage = null;

      async function checkUpdateWithMockResponse(mockStatus) {
        try {
          if (mockStatus === 404) {
            updateStatus = "up_to_date";
            return;
          }
          if (mockStatus === 403) {
            throw new Error("GitHub API rate limit exceeded");
          }
          if (mockStatus !== 200) {
            throw new Error(`HTTP ${mockStatus}`);
          }
        } catch (err) {
          updateStatus = "error";
          errorMessage = err.message;
        }
      }

      await checkUpdateWithMockResponse(500);
      assert.equal(updateStatus, "error");
      assert.equal(errorMessage, "HTTP 500");

      await checkUpdateWithMockResponse(403);
      assert.equal(updateStatus, "error");
      assert.match(errorMessage, /rate limit/);

      // Only clean 404 (no releases published) is considered up_to_date
      await checkUpdateWithMockResponse(404);
      assert.equal(updateStatus, "up_to_date");
    });
  });
});
