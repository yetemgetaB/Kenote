import posthog from "posthog-js";
import { APP_VERSION } from "./version.ts";

const POSTHOG_KEY = "phc_zErvHesRFUeAuvkbBRY5seV7H3JyQTdQ2NPqKESL4Lsx";
const POSTHOG_HOST = "https://eu.i.posthog.com";

// Strict allowlist of event names
export const ALLOWED_EVENTS = [
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
] as const;

export type AnalyticsEventName = (typeof ALLOWED_EVENTS)[number];

export type Platform = "windows" | "macos" | "linux";

export function getPlatform(): Platform {
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    const ua = navigator.userAgent;
    if (ua.includes("Win")) return "windows";
    if (ua.includes("Mac")) return "macos";
    return "linux";
  }
  if (typeof process !== "undefined" && process.platform) {
    if (process.platform === "win32") return "windows";
    if (process.platform === "darwin") return "macos";
    return "linux";
  }
  return "windows";
}

export interface BaseAnalyticsProperties {
  version: string;
  platform: Platform;
  [key: string]: unknown;
}

export const COMMAND_ACTIONS = [
  "new_note",
  "note_switcher",
  "toggle_pin",
  "copy_markdown",
  "reveal_in_explorer",
  "settings",
  "check_for_updates",
  "delete_note",
] as const;
export type CommandActionId = (typeof COMMAND_ACTIONS)[number];

export const FEATURE_ACTIONS = [
  "quick_switcher",
  "toggle_always_on_top",
  "toggle_autostart",
  "change_accent_color",
  "change_typography",
  "change_notes_directory",
  "reset_notes_directory",
  "empty_trash",
  "restore_trashed_note",
  "permanently_delete_note",
] as const;
export type FeatureActionId = (typeof FEATURE_ACTIONS)[number];

export const UPDATE_ERROR_CATEGORIES = [
  "check_failed",
  "download_failed",
  "install_failed",
  "unknown",
] as const;
export type UpdateErrorCategory = (typeof UPDATE_ERROR_CATEGORIES)[number];

export const APP_ERROR_CATEGORIES = [
  "storage_read",
  "storage_write",
  "settings_read",
  "settings_write",
  "window_state",
  "updater",
  "unknown",
] as const;
export type AppErrorCategory = (typeof APP_ERROR_CATEGORIES)[number];

let isTelemetryEnabled = true;
let isInitialized = false;
let hasTrackedAppLaunch = false;

export function _resetAppLaunchTrackedForTesting() {
  hasTrackedAppLaunch = false;
}

function getPostHogClient() {
  return (posthog as any)?.init ? posthog : (posthog as any)?.default ?? (posthog as any)?.posthog ?? posthog;
}

export function setTelemetryEnabled(enabled: boolean) {
  isTelemetryEnabled = enabled;
  if (!enabled) {
    if (isInitialized) {
      try {
        getPostHogClient().opt_out_capturing();
      } catch (e) {
        // Silently catch
      }
    }
  } else {
    if (isInitialized) {
      try {
        getPostHogClient().opt_in_capturing();
      } catch (e) {
        // Silently catch
      }
    }
  }
}

export function getTelemetryEnabled(): boolean {
  return isTelemetryEnabled;
}

export function buildEventPayload<T extends Record<string, unknown>>(
  customProps?: T
): BaseAnalyticsProperties & T {
  const base: BaseAnalyticsProperties = {
    version: APP_VERSION,
    platform: getPlatform(),
  };
  return { ...base, ...customProps } as BaseAnalyticsProperties & T;
}

export function initAnalytics(enabled: boolean = isTelemetryEnabled) {
  isTelemetryEnabled = enabled;
  if (!enabled) return;
  if (isInitialized) return;

  isInitialized = true;

  try {
    getPostHogClient().init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_performance: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_conversations: true,
      disable_product_tours: true,
      persistence: "localStorage",
      respect_dnt: true,
      property_denylist: [
        "$current_url",
        "$host",
        "$pathname",
        "$referrer",
        "$referring_domain",
        "$initial_current_url",
        "$initial_referrer",
        "$initial_referring_domain",
        "$raw_user_agent",
      ],
      before_send: (event: any) => {
        if (!event) return null;
        if (!isTelemetryEnabled) return null;
        if (!ALLOWED_EVENTS.includes(event.event as AnalyticsEventName)) return null;
        return event;
      },
    });
  } catch (e) {
    isInitialized = false;
    console.debug("Analytics initialization skipped:", e);
  }
}

function captureEvent(event: AnalyticsEventName, properties: BaseAnalyticsProperties) {
  if (!isTelemetryEnabled) {
    return;
  }
  try {
    initAnalytics();
    getPostHogClient().capture(event, properties);
  } catch (e) {
    console.debug("Analytics capture skipped:", e);
  }
}

// 1. Core Lifecycle
export function trackAppLaunch() {
  if (hasTrackedAppLaunch) {
    return;
  }
  hasTrackedAppLaunch = true;
  captureEvent("app_launched", buildEventPayload());
}

export function trackOnboardingComplete(source: string) {
  captureEvent(
    "onboarding_completed",
    buildEventPayload({
      discovery_source: source,
    })
  );
}

// 2. Note Lifecycle (strictly aggregate counts / occurrences, never titles, content, filenames, or paths)
export function trackNoteCreated() {
  captureEvent("note_created", buildEventPayload());
}

export function trackNoteDeleted() {
  captureEvent("note_deleted", buildEventPayload());
}

export function trackNoteRestored() {
  captureEvent("note_restored", buildEventPayload());
}

export function trackNotePermanentlyDeleted() {
  captureEvent("note_permanently_deleted", buildEventPayload());
}

// 3. Update Lifecycle
export function trackUpdateCheck(source: "automatic" | "manual") {
  captureEvent("update_check", buildEventPayload({ source }));
}

export function trackUpdateAvailable(targetVersion: string, source: "automatic" | "manual") {
  captureEvent(
    "update_available",
    buildEventPayload({
      target_version: targetVersion,
      source,
    })
  );
}

export function trackUpdateDownloadStarted(targetVersion: string, source: "automatic" | "manual") {
  captureEvent(
    "update_download_started",
    buildEventPayload({
      target_version: targetVersion,
      source,
    })
  );
}

export function trackUpdateSucceeded(targetVersion: string) {
  captureEvent(
    "update_succeeded",
    buildEventPayload({
      target_version: targetVersion,
    })
  );
}

export function trackUpdateFailed(
  errorCategory: UpdateErrorCategory,
  source: "automatic" | "manual" = "manual"
) {
  captureEvent(
    "update_failed",
    buildEventPayload({
      error_category: errorCategory,
      source,
    })
  );
}

// 4. Controlled Application Errors (never raw message, stack trace, or path)
export function trackAppError(errorCategory: AppErrorCategory) {
  captureEvent(
    "app_error",
    buildEventPayload({
      error_category: errorCategory,
    })
  );
}

// 5. Allowlisted Commands & Features
export function trackCommandUsed(actionId: CommandActionId) {
  captureEvent(
    "command_used",
    buildEventPayload({
      action_id: actionId,
    })
  );
}

export function trackFeatureUsed(actionId: FeatureActionId) {
  captureEvent(
    "feature_used",
    buildEventPayload({
      action_id: actionId,
    })
  );
}
