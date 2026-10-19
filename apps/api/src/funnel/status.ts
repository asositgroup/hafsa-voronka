import type { FunnelSegment, FunnelStatus } from "@funnel/shared";
import type { User, Video } from "@/db/schema";

export type StatusProgress = { maxPosition: number; startedAt: Date | null };

export const NO_VIDEO_MARKS = { duration: 1, introEndSec: null, courseStartSec: null, priceSec: null };

export function statusFor(
  progress: StatusProgress | undefined,
  video: Pick<Video, "duration" | "introEndSec" | "courseStartSec" | "priceSec">,
  user: Pick<User, "registeredAt" | "wroteAdminAt">,
): FunnelStatus | null {
  if (user.registeredAt === null) return null;
  if (user.wroteAdminAt !== null) return "adminga_yozdi";
  if (!progress || (progress.startedAt === null && progress.maxPosition === 0)) return "link_berildi";

  const position = progress.maxPosition;
  if (video.priceSec !== null && position >= video.priceSec) return "narxni_kurdi";
  if (video.courseStartSec !== null && position >= video.courseStartSec) return "sotuvda_toxtadi";

  const lessonStart = video.introEndSec ?? (video.courseStartSec ?? video.priceSec ?? video.duration) / 2;
  return position >= lessonStart ? "dars_yarmida" : "korishni_boshladi";
}

export function segmentFor(status: FunnelStatus | null): FunnelSegment | null {
  switch (status) {
    case "link_berildi":
      return "A";
    case "korishni_boshladi":
    case "dars_yarmida":
    case "sotuvda_toxtadi":
      return "B";
    case "narxni_kurdi":
      return "C";
    default:
      return null;
  }
}
