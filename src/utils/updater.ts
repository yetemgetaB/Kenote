import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauri } from "./tauriBridge.ts";
import { APP_VERSION, isVersionAtLeast } from "./version.ts";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "up_to_date"
  | "downloading"
  | "installing"
  | "ready_to_restart"
  | "error";

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  body?: string;
  date?: string;
}

export type ProgressCallback = (percent: number, downloadedBytes: number, totalBytes?: number) => void;

let activeUpdate: Update | null = null;

// ==========================================
// 1. Session-Level Startup Check Guard
// ==========================================
let hasCheckedStartupUpdateThisSession = false;
let isStartupUpdateDismissedThisSession = false;

export function isStartupUpdateEligible(): boolean {
  return !hasCheckedStartupUpdateThisSession && !isStartupUpdateDismissedThisSession;
}

export function markStartupUpdateCheckedThisSession(): void {
  hasCheckedStartupUpdateThisSession = true;
}

export function dismissStartupUpdateThisSession(): void {
  isStartupUpdateDismissedThisSession = true;
}

export function resetStartupUpdateSessionStateForTesting(): void {
  hasCheckedStartupUpdateThisSession = false;
  isStartupUpdateDismissedThisSession = false;
}

// ==========================================
// 2. Pending Post-Update Target State
// ==========================================
export const STORAGE_KEY_PENDING_UPDATE = "kenote_pending_update_target";
const PENDING_UPDATE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface PendingUpdateTarget {
  previousVersion: string;
  targetVersion: string;
  timestamp: number;
}

export function setPendingUpdateTarget(targetVersion: string, previousVersion?: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const payload: PendingUpdateTarget = {
      previousVersion: previousVersion || APP_VERSION,
      targetVersion,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY_PENDING_UPDATE, JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to persist pending update target:", err);
  }
}

export function getPendingUpdateTarget(): PendingUpdateTarget | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PENDING_UPDATE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.targetVersion !== "string" ||
      typeof parsed.previousVersion !== "string"
    ) {
      clearPendingUpdateTarget();
      return null;
    }
    // Check expiry
    if (typeof parsed.timestamp === "number" && Date.now() - parsed.timestamp > PENDING_UPDATE_EXPIRY_MS) {
      clearPendingUpdateTarget();
      return null;
    }
    return parsed as PendingUpdateTarget;
  } catch {
    clearPendingUpdateTarget();
    return null;
  }
}

export function clearPendingUpdateTarget(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY_PENDING_UPDATE);
  } catch {
    // Ignore storage clear errors
  }
}

export function checkPendingUpdateSuccess(currentVersion: string): {
  isSuccess: boolean;
  targetVersion?: string;
} {
  const pending = getPendingUpdateTarget();
  if (!pending) {
    return { isSuccess: false };
  }

  if (isVersionAtLeast(currentVersion, pending.targetVersion)) {
    // Successfully upgraded to target version or higher!
    clearPendingUpdateTarget();
    return { isSuccess: true, targetVersion: pending.targetVersion };
  }

  // If currentVersion is still less than target, do not show false success.
  // We keep the pending state intact until an actual successful upgrade or expiry.
  return { isSuccess: false };
}

// ==========================================
// 3. Core Updater Operations
// ==========================================
export async function checkForUpdate(): Promise<{
  available: boolean;
  update?: UpdateInfo;
  error?: string;
}> {
  if (!isTauri()) {
    return { available: false };
  }
  try {
    activeUpdate = await check();
    if (activeUpdate) {
      return {
        available: true,
        update: {
          version: activeUpdate.version,
          currentVersion: activeUpdate.currentVersion,
          body: activeUpdate.body,
          date: activeUpdate.date,
        },
      };
    }
    return { available: false };
  } catch (err: any) {
    activeUpdate = null;
    return { available: false, error: err?.message || String(err) };
  }
}

export async function installUpdate(
  onProgress?: ProgressCallback,
  onInstalling?: () => void
): Promise<void> {
  if (!activeUpdate) {
    throw new Error("No update ready to install.");
  }

  let totalBytes: number | undefined;
  let downloadedBytes = 0;

  await activeUpdate.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        totalBytes = event.data.contentLength;
        if (onProgress) onProgress(0, 0, totalBytes);
        break;
      case "Progress":
        downloadedBytes += event.data.chunkLength;
        if (onProgress) {
          const percent =
            totalBytes && totalBytes > 0
              ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
              : 0;
          onProgress(percent, downloadedBytes, totalBytes);
        }
        break;
      case "Finished":
        if (onInstalling) onInstalling();
        break;
    }
  });
}

export async function relaunchApp(): Promise<void> {
  if (isTauri()) {
    await relaunch();
  }
}
