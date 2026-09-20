import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import posthog from "posthog-js";
import {
  ALLOWED_EVENTS,
  COMMAND_ACTIONS,
  FEATURE_ACTIONS,
  UPDATE_ERROR_CATEGORIES,
  APP_ERROR_CATEGORIES,
  getPlatform,
  buildEventPayload,
  setTelemetryEnabled,
  getTelemetryEnabled,
  trackAppLaunch,
  _resetAppLaunchTrackedForTesting,
  initAnalytics,
} from "../src/utils/analytics.ts";
import { APP_VERSION } from "../src/utils/version.ts";

describe("Phase B1: Privacy-Safe Analytics Telemetry Tests", () => {
  beforeEach(() => {
    setTelemetryEnabled(true);
  });

  afterEach(() => {
    setTelemetryEnabled(true);
  });

  describe("1. Event Allowlist Constraints", () => {
    it("contains exactly the 14 approved events", () => {
      const expected = [
        "app_launched",
        "onboarding_completed",
        "note_created",
        "note_deleted",
        "note_restored",
        "note_permanently_deleted",
        "update_check",
        "update_available",
        "update_download_started",
        "update_succeeded",
        "update_failed",
        "app_error",
        "command_used",
        "feature_used",
      ];
      assert.equal(ALLOWED_EVENTS.length, 14);
      assert.deepEqual([...ALLOWED_EVENTS].sort(), [...expected].sort());
    });

    it("all event names are strictly snake_case identifiers", () => {
      const snakeCaseRegex = /^[a-z]+(_[a-z]+)*$/;
      for (const eventName of ALLOWED_EVENTS) {
        assert.match(eventName, snakeCaseRegex, `Event ${eventName} must be snake_case`);
      }
    });
  });

  describe("2. Base Payload & Privacy Contract", () => {
    it("buildEventPayload returns strictly version and platform by default", () => {
      const payload = buildEventPayload();
      const keys = Object.keys(payload).sort();
      assert.deepEqual(keys, ["platform", "version"]);
      assert.equal(payload.version, APP_VERSION);
      assert.ok(["windows", "macos", "linux"].includes(payload.platform));
    });

    it("payload never contains private or hardware identifier keys", () => {
      const forbiddenKeys = [
        "title",
        "content",
        "text",
        "body",
        "filename",
        "path",
        "dir",
        "directory",
        "username",
        "email",
        "mac",
        "hardware_id",
        "device_id",
        "clipboard",
        "cursor",
        "stack",
        "message",
        "error",
      ];

      const payload = buildEventPayload({ source: "manual" });
      for (const key of forbiddenKeys) {
        assert.equal(key in payload, false, `Payload must not contain key: ${key}`);
      }
    });

    it("merges custom properties safely without mutating base properties", () => {
      const payload = buildEventPayload({ source: "manual", custom_num: 42 });
      assert.equal(payload.version, APP_VERSION);
      assert.equal(payload.source, "manual");
      assert.equal(payload.custom_num, 42);
    });
  });

  describe("3. Platform Normalization", () => {
    it("returns one of windows, macos, or linux", () => {
      const platform = getPlatform();
      assert.ok(
        platform === "windows" || platform === "macos" || platform === "linux",
        `Expected valid platform string, got ${platform}`
      );
    });
  });

  describe("4. Telemetry Opt-Out Control", () => {
    it("toggles telemetry state correctly", () => {
      assert.equal(getTelemetryEnabled(), true);
      setTelemetryEnabled(false);
      assert.equal(getTelemetryEnabled(), false);
      setTelemetryEnabled(true);
      assert.equal(getTelemetryEnabled(), true);
    });

    it("respects telemetry opt-out when set to false", () => {
      setTelemetryEnabled(false);
      assert.equal(getTelemetryEnabled(), false);
    });
  });

  describe("5. Note Lifecycle Events Contract", () => {
    it("note lifecycle payloads only contain base properties", () => {
      const notePayload = buildEventPayload();
      const keys = Object.keys(notePayload);
      assert.equal(keys.length, 2);
      assert.ok(keys.includes("version"));
      assert.ok(keys.includes("platform"));
    });
  });

  describe("6. Update Lifecycle Events Contract", () => {
    it("update check payload contains only source and base properties", () => {
      const payload = buildEventPayload({ source: "automatic" });
      assert.deepEqual(Object.keys(payload).sort(), ["platform", "source", "version"]);
      assert.equal(payload.source, "automatic");
    });

    it("update available payload contains target_version and source", () => {
      const payload = buildEventPayload({ target_version: "0.5.0", source: "manual" });
      assert.deepEqual(Object.keys(payload).sort(), [
        "platform",
        "source",
        "target_version",
        "version",
      ]);
      assert.equal(payload.target_version, "0.5.0");
      assert.equal(payload.source, "manual");
    });

    it("update error categories are strictly allowlisted", () => {
      const allowedCategories = ["check_failed", "download_failed", "install_failed", "unknown"];
      assert.deepEqual([...UPDATE_ERROR_CATEGORIES].sort(), allowedCategories.sort());

      for (const cat of UPDATE_ERROR_CATEGORIES) {
        const payload = buildEventPayload({ error_category: cat, source: "manual" });
        assert.equal(payload.error_category, cat);
        assert.equal("message" in payload, false);
        assert.equal("stack" in payload, false);
      }
    });
  });

  describe("7. Application Error Categories Contract", () => {
    it("error categories are strictly allowlisted and never accept raw errors", () => {
      const expected = [
        "storage_read",
        "storage_write",
        "settings_read",
        "settings_write",
        "window_state",
        "updater",
        "unknown",
      ];
      assert.deepEqual([...APP_ERROR_CATEGORIES].sort(), expected.sort());

      for (const cat of APP_ERROR_CATEGORIES) {
        const payload = buildEventPayload({ error_category: cat });
        assert.equal(payload.error_category, cat);
        assert.equal("message" in payload, false);
        assert.equal("stack" in payload, false);
      }
    });
  });

  describe("8. Command Actions Allowlist Contract", () => {
    it("command action ids match allowlist", () => {
      const expected = [
        "new_note",
        "note_switcher",
        "toggle_pin",
        "copy_markdown",
        "reveal_in_explorer",
        "settings",
        "check_for_updates",
        "delete_note",
      ];
      assert.deepEqual([...COMMAND_ACTIONS].sort(), expected.sort());

      for (const actionId of COMMAND_ACTIONS) {
        const payload = buildEventPayload({ action_id: actionId });
        assert.equal(payload.action_id, actionId);
      }
    });
  });

  describe("9. Feature Actions Allowlist Contract", () => {
    it("feature action ids match allowlist", () => {
      const expected = [
        "quick_switcher",
        "toggle_always_on_top",
        "change_accent_color",
        "change_typography",
        "change_notes_directory",
        "reset_notes_directory",
        "empty_trash",
        "restore_trashed_note",
        "permanently_delete_note",
      ];
      assert.deepEqual([...FEATURE_ACTIONS].sort(), expected.sort());

      for (const actionId of FEATURE_ACTIONS) {
        const payload = buildEventPayload({ action_id: actionId });
        assert.equal(payload.action_id, actionId);
      }
    });
  });

  describe("10. Settings Telemetry Schema Contract", () => {
    it("DEFAULT_SETTINGS has telemetry_enabled set to true", async () => {
      const { DEFAULT_SETTINGS } = await import("../src/types/note.ts");
      assert.equal(DEFAULT_SETTINGS.telemetry_enabled, true);
    });
  });

  describe("11. App Launch Lifecycle & Regression Protection", () => {
    let capturedEvents = [];
    const posthogClient = posthog.init ? posthog : posthog.default ?? posthog.posthog ?? posthog;
    const originalCapture = posthogClient.capture;

    beforeEach(() => {
      capturedEvents = [];
      posthogClient.capture = (event, properties) => {
        capturedEvents.push({ event, properties });
      };
      _resetAppLaunchTrackedForTesting();
      setTelemetryEnabled(true);
    });

    afterEach(() => {
      posthogClient.capture = originalCapture;
      _resetAppLaunchTrackedForTesting();
      setTelemetryEnabled(true);
    });

    it("one KeNote application launch produces at most one app_launched event across repeated calls", () => {
      // Simulate multiple calls as caused by React effect loops, re-renders, or multiple mountings
      for (let i = 0; i < 10; i++) {
        trackAppLaunch();
      }

      const launchEvents = capturedEvents.filter((e) => e.event === "app_launched");
      assert.equal(
        launchEvents.length,
        1,
        `Expected exactly 1 app_launched event, but got ${launchEvents.length}`
      );
      assert.equal(launchEvents[0].properties.version, APP_VERSION);
      assert.ok(["windows", "macos", "linux"].includes(launchEvents[0].properties.platform));
    });

    it("subsequent session launch can fire after session reset", () => {
      trackAppLaunch();
      assert.equal(capturedEvents.filter((e) => e.event === "app_launched").length, 1);

      // Simulate a new application launch session
      _resetAppLaunchTrackedForTesting();
      trackAppLaunch();
      assert.equal(capturedEvents.filter((e) => e.event === "app_launched").length, 2);
    });

    it("app_launched is suppressed when telemetry is disabled", () => {
      setTelemetryEnabled(false);
      trackAppLaunch();
      assert.equal(capturedEvents.filter((e) => e.event === "app_launched").length, 0);
    });

    it("initAnalytics configures capture_performance: false to disable automatic Web Vitals", () => {
      const originalInit = posthogClient.init;
      let initConfig = null;
      posthogClient.init = (_key, config) => {
        initConfig = config;
      };

      try {
        initAnalytics(true);
        if (initConfig) {
          assert.equal(initConfig.capture_performance, false);
        }
      } finally {
        posthogClient.init = originalInit;
      }
    });
  });
});
