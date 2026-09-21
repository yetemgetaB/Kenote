import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Mock localStorage for Node test runner
const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  },
};

const {
  isStartupUpdateEligible,
  markStartupUpdateCheckedThisSession,
  dismissStartupUpdateThisSession,
  resetStartupUpdateSessionStateForTesting,
  setPendingUpdateTarget,
  getPendingUpdateTarget,
  clearPendingUpdateTarget,
  checkPendingUpdateSuccess,
  STORAGE_KEY_PENDING_UPDATE,
} = await import("../src/utils/updater.ts");

const { isVersionAtLeast, isNewerVersion } = await import("../src/utils/version.ts");
const { renderSafeMarkdown, isValidHttpUrl } = await import("../src/utils/markdown.ts");

describe("KeNote Updater UX & Release Notes Tests", () => {
  beforeEach(() => {
    storage.clear();
    resetStartupUpdateSessionStateForTesting();
  });

  describe("1. Startup Check Session Guard & Lifecycle", () => {
    it("is eligible for check on fresh session startup", () => {
      assert.equal(isStartupUpdateEligible(), true);
    });

    it("prevents multiple checks within the same session", () => {
      assert.equal(isStartupUpdateEligible(), true);
      markStartupUpdateCheckedThisSession();
      assert.equal(isStartupUpdateEligible(), false);
      // Repeated invocation does not reset eligibility
      markStartupUpdateCheckedThisSession();
      assert.equal(isStartupUpdateEligible(), false);
    });

    it("dismissing with Later marks update ineligible for current session", () => {
      assert.equal(isStartupUpdateEligible(), true);
      dismissStartupUpdateThisSession();
      assert.equal(isStartupUpdateEligible(), false);
    });

    it("resets eligibility when a new application session begins", () => {
      markStartupUpdateCheckedThisSession();
      assert.equal(isStartupUpdateEligible(), false);
      resetStartupUpdateSessionStateForTesting();
      assert.equal(isStartupUpdateEligible(), true);
    });
  });

  describe("2. Version Comparison Utility", () => {
    it("isVersionAtLeast correctly evaluates versions", () => {
      assert.equal(isVersionAtLeast("0.5.3", "0.5.2"), true);
      assert.equal(isVersionAtLeast("0.5.3", "0.5.3"), true);
      assert.equal(isVersionAtLeast("0.5.2", "0.5.3"), false);
      assert.equal(isVersionAtLeast("0.6.0", "0.5.3"), true);
      assert.equal(isVersionAtLeast("1.0.0", "0.5.3"), true);
      assert.equal(isVersionAtLeast("0.5.1", "0.5.2"), false);
    });

    it("handles v prefix gracefully in isVersionAtLeast", () => {
      assert.equal(isVersionAtLeast("v0.5.3", "v0.5.2"), true);
      assert.equal(isVersionAtLeast("v0.5.3", "0.5.3"), true);
      assert.equal(isVersionAtLeast("0.5.2", "v0.5.3"), false);
    });
  });

  describe("3. Post-Update Success Detection & Persistence", () => {
    it("persists pending update target before restart", () => {
      setPendingUpdateTarget("0.5.3", "0.5.2");
      const pending = getPendingUpdateTarget();
      assert.ok(pending);
      assert.equal(pending.targetVersion, "0.5.3");
      assert.equal(pending.previousVersion, "0.5.2");
      assert.ok(typeof pending.timestamp === "number");
    });

    it("does NOT show success if application launches still running the old version", () => {
      setPendingUpdateTarget("0.5.3", "0.5.2");

      // App relaunches but is still v0.5.2 (update failed or was cancelled)
      const result = checkPendingUpdateSuccess("0.5.2");
      assert.equal(result.isSuccess, false);

      // Pending state must NOT be cleared prematurely simply because version is still old
      const pendingStillStored = getPendingUpdateTarget();
      assert.ok(pendingStillStored);
      assert.equal(pendingStillStored.targetVersion, "0.5.3");
    });

    it("shows success when running version matches target and clears state immediately", () => {
      setPendingUpdateTarget("0.5.3", "0.5.2");

      // App relaunches running target version v0.5.3
      const result = checkPendingUpdateSuccess("0.5.3");
      assert.equal(result.isSuccess, true);
      assert.equal(result.targetVersion, "0.5.3");

      // Pending state is now cleared to prevent duplicate notification
      assert.equal(getPendingUpdateTarget(), null);

      // Subsequent check / restart must NOT show success again
      const subsequentResult = checkPendingUpdateSuccess("0.5.3");
      assert.equal(subsequentResult.isSuccess, false);
    });

    it("shows success when running version exceeds target (e.g. multi-version leap)", () => {
      setPendingUpdateTarget("0.5.3", "0.5.1");

      const result = checkPendingUpdateSuccess("0.5.4");
      assert.equal(result.isSuccess, true);
      assert.equal(getPendingUpdateTarget(), null);
    });

    it("handles corrupt or invalid storage gracefully without crashing", () => {
      storage.set(STORAGE_KEY_PENDING_UPDATE, "invalid JSON {corrupt}");
      assert.equal(getPendingUpdateTarget(), null);
      const result = checkPendingUpdateSuccess("0.5.3");
      assert.equal(result.isSuccess, false);
    });

    it("ignores expired pending update state older than 7 days", () => {
      const expiredTime = Date.now() - 8 * 24 * 60 * 60 * 1000;
      storage.set(
        STORAGE_KEY_PENDING_UPDATE,
        JSON.stringify({ previousVersion: "0.5.1", targetVersion: "0.5.2", timestamp: expiredTime })
      );
      assert.equal(getPendingUpdateTarget(), null);
    });
  });

  describe("4. Release Notes Markdown Rendering & Security", () => {
    it("renders headings properly", () => {
      const md = "## What's New\n\n### Bug Fixes";
      const html = renderSafeMarkdown(md);
      assert.match(html, /<h2>What's New<\/h2>/);
      assert.match(html, /<h3>Bug Fixes<\/h3>/);
    });

    it("renders bullet and numbered lists", () => {
      const md = "- Item Alpha\n- Item Beta\n\n1. First\n2. Second";
      const html = renderSafeMarkdown(md);
      assert.match(html, /<ul>/);
      assert.match(html, /<li>Item Alpha<\/li>/);
      assert.match(html, /<li>Item Beta<\/li>/);
      assert.match(html, /<ol>/);
      assert.match(html, /<li>First<\/li>/);
      assert.match(html, /<li>Second<\/li>/);
    });

    it("renders bold and inline code formatting", () => {
      const md = "This is **bold text** and this is `inline code`.";
      const html = renderSafeMarkdown(md);
      assert.match(html, /<strong>bold text<\/strong>/);
      assert.match(html, /<code>inline code<\/code>/);
    });

    it("escapes dangerous HTML tags and prevents script execution", () => {
      const malicious = '<script>alert("pwned")</script><img src=x onerror=alert(1)>';
      const html = renderSafeMarkdown(malicious);
      // Raw executable tags must NOT be present
      assert.doesNotMatch(html, /<script>/i);
      assert.doesNotMatch(html, /<img\s/i);
      // Must be safely escaped as entity text
      assert.match(html, /&lt;script&gt;/);
      assert.match(html, /&lt;img/);
    });

    it("rejects dangerous URL schemes and protocols", () => {
      assert.equal(isValidHttpUrl("javascript:alert(document.domain)"), false);
      assert.equal(isValidHttpUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="), false);
      assert.equal(isValidHttpUrl("file:///C:/Windows/System32/cmd.exe"), false);
      assert.equal(isValidHttpUrl("vbscript:msgbox(1)"), false);
      assert.equal(isValidHttpUrl("powershell:Start-Process"), false);
    });

    it("allows standard secure HTTP and HTTPS links with target=_blank and noopener", () => {
      assert.equal(isValidHttpUrl("https://github.com/yetemgetaB/Kenote"), true);
      assert.equal(isValidHttpUrl("http://localhost:3000"), true);

      const mdWithLinks = "[Kenote Repo](https://github.com/yetemgetaB/Kenote)\n[Bad Link](javascript:alert(1))";
      const html = renderSafeMarkdown(mdWithLinks);

      // Safe link has href and security attributes
      assert.match(html, /href="https:\/\/github\.com\/yetemgetaB\/Kenote"/);
      assert.match(html, /target="_blank"/);
      assert.match(html, /rel="noopener noreferrer"/);

      // Bad link does NOT have javascript: in href
      assert.doesNotMatch(html, /href="javascript:/i);
    });

    it("provides clean fallback when release notes body is empty", () => {
      const html = renderSafeMarkdown("");
      assert.match(html, /General stability and performance improvements/);
    });
  });
});
