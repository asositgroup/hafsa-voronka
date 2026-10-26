import type { FunnelSegment, FunnelStatus, SegmentEndReason } from "@funnel/shared";
import type { User, Video } from "@/db/schema";

export type StatusProgress = { maxPosition: number; startedAt: Date | null };

export const NO_VIDEO_MARKS = { duration: 1, introEndSec: null, courseStartSec: null, priceSec: null };

export function statusFor(
  progress: StatusProgress | undefined,
  video: Pick<Video, "duration" | "introEndSec" | "courseStartSec" | "priceSec">,
  user: Pick<User, "registeredAt" | "wroteAdminAt" | "offerWatchedAt">,
): FunnelStatus | null {
  if (user.registeredAt === null) return null;
  if (user.wroteAdminAt !== null) return "adminga_yozdi";
  if (user.offerWatchedAt !== null) return "narxni_kurdi";
  if (!progress || (progress.startedAt === null && progress.maxPosition === 0)) return "link_berildi";

  const position = progress.maxPosition;
  if (video.priceSec !== null && position >= video.priceSec) return "narxni_kurdi";
  if (video.courseStartSec !== null && position >= video.courseStartSec) return "sotuvda_toxtadi";

  const lessonStart = video.introEndSec ?? (video.courseStartSec ?? video.priceSec ?? video.duration) / 2;
  return position >= lessonStart ? "dars_yarmida" : "korishni_boshladi";
}

export function isLessonClosed(
  user: Pick<User, "registeredAt" | "linkExpiresAt" | "completedAt">,
  status: FunnelStatus | null,
  now: Date,
): boolean {
  return (
    user.registeredAt !== null &&
    user.linkExpiresAt !== null &&
    now >= user.linkExpiresAt &&
    user.completedAt === null &&
    status !== "narxni_kurdi" &&
    status !== "adminga_yozdi"
  );
}

export type LinkState = "live" | "expired" | "exhausted";

function linkBound(segment: FunnelSegment, linkState: LinkState): FunnelSegment | null {
  if (linkState === "live") return segment;
  return linkState === "expired" ? "D" : null;
}

export function segmentFor(status: FunnelStatus | null, linkState: LinkState = "live"): FunnelSegment | null {
  switch (status) {
    case "link_berildi":
      return linkBound("A", linkState);
    case "korishni_boshladi":
    case "dars_yarmida":
    case "sotuvda_toxtadi":
      return linkBound("B", linkState);
    case "narxni_kurdi":
      return "C";
    default:
      return null;
  }
}

export function endReasonFor(
  open: FunnelSegment,
  target: FunnelSegment | null,
  user: { botBlocked: boolean; wroteAdmin: boolean },
): SegmentEndReason {
  if (target === null) {
    if (user.botBlocked) return "bot_blocked";
    return user.wroteAdmin ? "wrote_admin" : "offers_exhausted";
  }
  if (open === "D" || open === target) return "relinked";
  return target === "D" ? "expired" : "advanced";
}
