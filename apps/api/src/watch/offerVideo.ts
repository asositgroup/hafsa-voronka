import type { StartMode } from "@funnel/shared";
import type { Video } from "@/db/schema";

export const OFFER_COMPLETE_FRACTION = 0.9;
export const MAX_PLAYBACK_SPEED = 2.2;

export type OfferFirst = { url: string; duration: number };

export function isOfferComplete(input: {
  position: number;
  duration: number;
  startedAt: Date | null;
  now: Date;
}): boolean {
  if (input.startedAt === null) return false;
  const requiredSecs = input.duration * OFFER_COMPLETE_FRACTION;
  if (input.position < requiredSecs) return false;
  const elapsedSecs = (input.now.getTime() - input.startedAt.getTime()) / 1000;
  return elapsedSecs >= requiredSecs / MAX_PLAYBACK_SPEED;
}

export function startPlanFor(input: {
  grantOfferFirst: boolean;
  offerWatchedAt: Date | null;
  video: Pick<Video, "shortOfferVideoUrl" | "shortOfferDuration" | "courseStartSec">;
  lastPosition: number;
  start: StartMode | undefined;
}): { offerFirst: OfferFirst | null; startAt: number; startsAtCourse: boolean } {
  const { video, lastPosition } = input;
  const pending = input.grantOfferFirst && input.offerWatchedAt === null;
  const hasShort = video.shortOfferVideoUrl !== null && video.shortOfferDuration !== null;
  const offerFirst: OfferFirst | null =
    pending && hasShort ? { url: video.shortOfferVideoUrl!, duration: video.shortOfferDuration! } : null;

  const courseStart = video.courseStartSec;
  const fallsBackToCourse = pending && !hasShort && courseStart !== null && lastPosition < courseStart;
  if (courseStart !== null && (input.start === "offer" || fallsBackToCourse)) {
    return { offerFirst, startAt: courseStart, startsAtCourse: true };
  }
  return { offerFirst, startAt: lastPosition, startsAtCourse: false };
}
