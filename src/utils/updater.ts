import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauri } from "./tauriBridge";

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
