import { useCallback, useEffect, useRef, type RefObject } from "react";
import { REAPPLY_MAX_ATTEMPTS, shouldReapply } from "./resume";

const VERIFY_DELAY_MS = 500;

export function useResumeSeek(videoRef: RefObject<HTMLVideoElement | null>, target: number) {
  const userSeekedRef = useRef(false);
  const settledRef = useRef(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || target <= 0) {
      settledRef.current = true;
      return;
    }

    let attempts = 0;
    let verifyTimer: ReturnType<typeof setTimeout> | null = null;
    settledRef.current = false;
    userSeekedRef.current = false;

    function verify() {
      if (settledRef.current) return;
      if (!shouldReapply(video!.currentTime, target, userSeekedRef.current)) {
        settledRef.current = true;
        return;
      }
      apply();
    }

    function apply() {
      if (settledRef.current) return;
      if (shouldReapply(video!.currentTime, target, userSeekedRef.current)) {
        if (attempts >= REAPPLY_MAX_ATTEMPTS) {
          settledRef.current = true;
          return;
        }
        attempts += 1;
        video!.currentTime = target;
      }
      if (verifyTimer) clearTimeout(verifyTimer);
      verifyTimer = setTimeout(verify, VERIFY_DELAY_MS);
    }

    const events = ["loadedmetadata", "canplay", "play"] as const;
    for (const name of events) video.addEventListener(name, apply);
    if (video.readyState >= 1) apply();

    return () => {
      for (const name of events) video.removeEventListener(name, apply);
      if (verifyTimer) clearTimeout(verifyTimer);
    };
  }, [videoRef, target]);

  const markUserSeeked = useCallback(() => {
    userSeekedRef.current = true;
  }, []);

  const isPositionPending = useCallback(() => {
    const video = videoRef.current;
    return (
      !settledRef.current &&
      video !== null &&
      shouldReapply(video.currentTime, target, userSeekedRef.current)
    );
  }, [videoRef, target]);

  return { markUserSeeked, isPositionPending };
}
