import type { StartMode } from "@funnel/shared";

export const RESUME_OVERLAY_MIN_SECS = 30;
export const RESUME_REWIND_SECS = 5;
export const REAPPLY_TOLERANCE_SECS = 2;
export const REAPPLY_MAX_ATTEMPTS = 3;
export const SEEK_BLOCK_SLACK_SECS = 1;
export const CLOSING_BEAT_DEDUPE_MS = 1000;

export type LocalResume = {
  videoId: number;
  position: number;
  at: number;
};

export function shouldReapply(current: number, target: number, userSeeked: boolean) {
  return !userSeeked && target > 0 && current < target - REAPPLY_TOLERANCE_SECS;
}

export function mergeResume(
  server: { videoId: number; lastPosition: number; maxPosition: number },
  local: LocalResume | null,
) {
  const localPosition = local && local.videoId === server.videoId ? local.position : 0;
  const candidate = Math.max(server.lastPosition, localPosition);
  return Math.max(0, Math.min(server.maxPosition, candidate));
}

export function shouldShowResumeOverlay(input: {
  startMode: string | undefined;
  resumeFrom: number;
  completed: boolean;
}) {
  return (
    input.startMode !== "offer" &&
    !input.completed &&
    input.resumeFrom > RESUME_OVERLAY_MIN_SECS
  );
}

export function resumeTarget(resumeFrom: number) {
  return Math.max(0, resumeFrom - RESUME_REWIND_SECS);
}

export function isSeekLocked(input: {
  seekLock: boolean;
  completed: boolean;
  priceSec: number | null;
  maxReached: number;
}) {
  const pastPrice = input.priceSec !== null && input.maxReached >= input.priceSec;
  return input.seekLock && !input.completed && !pastPrice;
}

export function isSeekBlocked(target: number, maxReached: number, locked: boolean) {
  return locked && target > maxReached + SEEK_BLOCK_SLACK_SECS;
}

export function shouldSendClosingBeat(lastSentAt: number | null, now: number) {
  return lastSentAt === null || now - lastSentAt >= CLOSING_BEAT_DEDUPE_MS;
}

export function effectiveStartMode(urlMode: StartMode | undefined, startsAtCourse: boolean): StartMode | undefined {
  return startsAtCourse ? "offer" : urlMode;
}
