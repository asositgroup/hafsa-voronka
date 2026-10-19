import { describe, expect, it } from "vitest";
import {
  effectiveStartMode,
  isSeekBlocked,
  isSeekLocked,
  mergeResume,
  resumeTarget,
  shouldReapply,
  shouldSendClosingBeat,
  shouldShowResumeOverlay,
} from "./resume";

describe("shouldReapply", () => {
  it("reapplies when the player is more than 2s before the target", () => {
    expect(shouldReapply(0, 300, false)).toBe(true);
    expect(shouldReapply(297.9, 300, false)).toBe(true);
  });

  it("stops once the player is within 2s of the target", () => {
    expect(shouldReapply(298, 300, false)).toBe(false);
    expect(shouldReapply(305, 300, false)).toBe(false);
  });

  it("never fights a user seek", () => {
    expect(shouldReapply(0, 300, true)).toBe(false);
  });

  it("does nothing without a target", () => {
    expect(shouldReapply(0, 0, false)).toBe(false);
  });
});

describe("mergeResume", () => {
  const server = { videoId: 7, lastPosition: 100, maxPosition: 200 };

  it("takes the larger of server and local", () => {
    expect(mergeResume(server, { videoId: 7, position: 150, at: 1 })).toBe(150);
    expect(mergeResume(server, { videoId: 7, position: 50, at: 1 })).toBe(100);
  });

  it("never exceeds the server maxPosition", () => {
    expect(mergeResume(server, { videoId: 7, position: 900, at: 1 })).toBe(200);
  });

  it("ignores local data from another video", () => {
    expect(mergeResume(server, { videoId: 8, position: 150, at: 1 })).toBe(100);
  });

  it("works without local data", () => {
    expect(mergeResume(server, null)).toBe(100);
  });
});

describe("shouldShowResumeOverlay", () => {
  it("shows beyond 30s for resume and default starts", () => {
    expect(shouldShowResumeOverlay({ startMode: undefined, resumeFrom: 312, completed: false })).toBe(true);
    expect(shouldShowResumeOverlay({ startMode: "resume", resumeFrom: 31, completed: false })).toBe(true);
  });

  it("hides at 30s or less", () => {
    expect(shouldShowResumeOverlay({ startMode: "resume", resumeFrom: 30, completed: false })).toBe(false);
  });

  it("hides for offer and completed", () => {
    expect(shouldShowResumeOverlay({ startMode: "offer", resumeFrom: 312, completed: false })).toBe(false);
    expect(shouldShowResumeOverlay({ startMode: "resume", resumeFrom: 312, completed: true })).toBe(false);
  });
});

describe("resumeTarget", () => {
  it("starts 5s earlier and never below zero", () => {
    expect(resumeTarget(312)).toBe(307);
    expect(resumeTarget(3)).toBe(0);
  });
});

describe("isSeekLocked", () => {
  const base = { seekLock: true, completed: false, priceSec: 1102, maxReached: 300 };

  it("locks before the price point", () => {
    expect(isSeekLocked(base)).toBe(true);
  });

  it("unlocks once maxReached reaches the price point", () => {
    expect(isSeekLocked({ ...base, maxReached: 1102 })).toBe(false);
  });

  it("unlocks when completed or when the lock is off", () => {
    expect(isSeekLocked({ ...base, completed: true })).toBe(false);
    expect(isSeekLocked({ ...base, seekLock: false })).toBe(false);
  });

  it("stays locked without a price point", () => {
    expect(isSeekLocked({ ...base, priceSec: null, maxReached: 5000 })).toBe(true);
  });
});

describe("isSeekBlocked", () => {
  it("blocks a click beyond maxReached and allows one before it", () => {
    expect(isSeekBlocked(600, 180, true)).toBe(true);
    expect(isSeekBlocked(60, 180, true)).toBe(false);
  });

  it("allows 1s of slack and everything when unlocked", () => {
    expect(isSeekBlocked(181, 180, true)).toBe(false);
    expect(isSeekBlocked(600, 180, false)).toBe(false);
  });
});

describe("shouldSendClosingBeat", () => {
  it("dedupes within 1s", () => {
    expect(shouldSendClosingBeat(null, 5000)).toBe(true);
    expect(shouldSendClosingBeat(5000, 5500)).toBe(false);
    expect(shouldSendClosingBeat(5000, 6000)).toBe(true);
  });
});

describe("effectiveStartMode", () => {
  it("jumps to the course start whenever the session says so", () => {
    expect(effectiveStartMode("again", true)).toBe("offer");
    expect(effectiveStartMode(undefined, true)).toBe("offer");
  });

  it("keeps the link start mode otherwise", () => {
    expect(effectiveStartMode("again", false)).toBe("again");
    expect(effectiveStartMode(undefined, false)).toBeUndefined();
  });
});
