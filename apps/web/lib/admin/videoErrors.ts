import type { VideosResult } from "@/lib/admin/videos";
import { adminUz } from "@/lib/i18n/admin";

const errors = adminUz.videos.errors;

export function videoFailureMessage(result: Extract<VideosResult, { ok: false }>) {
  if (result.error === "video_in_use") return errors.video_in_use.replace("{count}", String(result.userCount ?? 0));
  return errors[result.error as keyof typeof errors] ?? errors.generic;
}

export const genericVideoError = errors.generic;
