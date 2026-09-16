import posthog from "posthog-js";
import { APP_VERSION } from "./version";

const POSTHOG_KEY = "phc_zErvHesRFUeAuvkbBRY5seV7H3JyQTdQ2NPqKESL4Lsx";
const POSTHOG_HOST = "https://eu.i.posthog.com";

let isInitialized = false;

export function initAnalytics() {
  if (isInitialized) return;
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      persistence: "localStorage",
      respect_dnt: true,
      loaded: () => {
        isInitialized = true;
      },
    });
  } catch (e) {
    console.error("Analytics initialization failed:", e);
  }
}

export function trackAppLaunch(version: string = APP_VERSION) {
  try {
    initAnalytics();
    posthog.capture("app_launched", {
      version,
      platform: navigator.userAgent.includes("Windows")
        ? "windows"
        : navigator.userAgent.includes("Mac")
        ? "macos"
        : "linux",
    });
  } catch (e) {
    console.debug("Analytics track failed:", e);
  }
}

export function trackOnboardingComplete(source: string, version: string = APP_VERSION) {
  try {
    initAnalytics();
    posthog.capture("onboarding_completed", {
      discovery_source: source,
      version,
      platform: navigator.userAgent.includes("Windows")
        ? "windows"
        : navigator.userAgent.includes("Mac")
        ? "macos"
        : "linux",
    });
  } catch (e) {
    console.debug("Analytics track failed:", e);
  }
}
