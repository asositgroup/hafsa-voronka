import { getTelegramWebApp } from "@/lib/telegram";
import type { LocalResume } from "./resume";

const STORAGE_KEY = "vf_resume";

function parse(raw: string | null | undefined): LocalResume | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LocalResume>;
    if (
      typeof value.videoId === "number" &&
      typeof value.position === "number" &&
      typeof value.at === "number" &&
      Number.isFinite(value.position)
    ) {
      return { videoId: value.videoId, position: value.position, at: value.at };
    }
  } catch {
    return null;
  }
  return null;
}

export function readLocalResume(): LocalResume | null {
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeLocalResume(videoId: number, position: number) {
  const value: LocalResume = { videoId, position, at: Date.now() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    return;
  }
}

export function readCloudResume(): Promise<LocalResume | null> {
  return new Promise((resolve) => {
    try {
      const storage = getTelegramWebApp()?.CloudStorage;
      if (!storage) {
        resolve(null);
        return;
      }
      storage.getItem(STORAGE_KEY, (error, value) => {
        resolve(error ? null : parse(value));
      });
    } catch {
      resolve(null);
    }
  });
}

export function writeCloudResume(videoId: number, position: number) {
  try {
    const value: LocalResume = { videoId, position, at: Date.now() };
    getTelegramWebApp()?.CloudStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    return;
  }
}
