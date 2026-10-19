import type { FunnelSegment, FunnelStatus } from "@funnel/shared";
import type { User, Video } from "@/db/schema";

export type StatusProgress = { maxPosition: number; startedAt: Date | null };

export function statusFor(
  progress: StatusProgress | undefined,
  video: Pick<Video, "duration" | "introEndSec" | "courseStartSec" | "priceSec">,
  user: Pick<User, "registeredAt" | "channelClickAt">,
): FunnelStatus | null {
  if (user.registeredAt === null) return null;
  if (user.channelClickAt !== null) return "adminga_yozdi";
  if (!progress || (progress.startedAt === null && progress.maxPosition === 0)) return "link_berildi";

  const position = progress.maxPosition;
  if (video.priceSec !== null && position >= video.priceSec) return "narxni_kurdi";
  if (video.courseStartSec !== null && position >= video.courseStartSec) return "sotuvda_toxtadi";

  const lessonEnd = video.courseStartSec ?? video.priceSec ?? video.duration;
  const midpoint = ((video.introEndSec ?? 0) + lessonEnd) / 2;
  return position >= midpoint ? "dars_yarmida" : "korishni_boshladi";
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
