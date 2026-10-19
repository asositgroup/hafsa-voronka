import { describe, expect, it } from "vitest";
import { isOfferComplete, startPlanFor } from "./offerVideo";

const startedAt = new Date(1_000_000);
const after = (secs: number) => new Date(startedAt.getTime() + secs * 1000);
const short = { shortOfferVideoUrl: "https://cdn.example.com/offer.mp4", shortOfferDuration: 100 };
const noShort = { shortOfferVideoUrl: null, shortOfferDuration: null };

describe("isOfferComplete", () => {
  const base = { duration: 100, startedAt };

  it("needs 90 percent of the clip", () => {
    expect(isOfferComplete({ ...base, position: 89, now: after(100) })).toBe(false);
    expect(isOfferComplete({ ...base, position: 90, now: after(100) })).toBe(true);
  });

  it("rejects a completion that arrives faster than 2.2x playback allows", () => {
    expect(isOfferComplete({ ...base, position: 100, now: after(10) })).toBe(false);
    expect(isOfferComplete({ ...base, position: 100, now: after(40) })).toBe(false);
    expect(isOfferComplete({ ...base, position: 100, now: after(41) })).toBe(true);
  });

  it("rejects a completion before the clip was ever played", () => {
    expect(isOfferComplete({ ...base, startedAt: null, position: 100, now: after(500) })).toBe(false);
  });
});

describe("startPlanFor", () => {
  const input = {
    grantOfferFirst: true,
    offerWatchedAt: null as Date | null,
    video: { ...short, courseStartSec: 300 },
    lastPosition: 40,
    start: undefined as "resume" | "offer" | "again" | undefined,
  };

  it("plays the short clip first when the grant asks for it", () => {
    expect(startPlanFor(input)).toEqual({
      offerFirst: { url: short.shortOfferVideoUrl, duration: 100 },
      startAt: 40,
      startsAtCourse: false,
    });
  });

  it("goes back to the full video once the clip was watched", () => {
    expect(startPlanFor({ ...input, offerWatchedAt: new Date(1) })).toEqual({
      offerFirst: null,
      startAt: 40,
      startsAtCourse: false,
    });
  });

  it("falls back to the course start when the video has no clip", () => {
    expect(startPlanFor({ ...input, video: { ...noShort, courseStartSec: 300 } })).toEqual({
      offerFirst: null,
      startAt: 300,
      startsAtCourse: true,
    });
  });

  it("does not pull someone back who is already past the course start", () => {
    expect(startPlanFor({ ...input, video: { ...noShort, courseStartSec: 300 }, lastPosition: 450 })).toEqual({
      offerFirst: null,
      startAt: 450,
      startsAtCourse: false,
    });
  });

  it("ignores a clip without a known duration", () => {
    const video = { shortOfferVideoUrl: short.shortOfferVideoUrl, shortOfferDuration: null, courseStartSec: null };
    expect(startPlanFor({ ...input, video })).toMatchObject({ offerFirst: null, startAt: 40 });
  });

  it("changes nothing for a plain grant", () => {
    expect(startPlanFor({ ...input, grantOfferFirst: false })).toEqual({
      offerFirst: null,
      startAt: 40,
      startsAtCourse: false,
    });
  });

  it("keeps the offer link behaviour of jumping to the course start", () => {
    expect(startPlanFor({ ...input, grantOfferFirst: false, start: "offer" })).toEqual({
      offerFirst: null,
      startAt: 300,
      startsAtCourse: true,
    });
    expect(
      startPlanFor({ ...input, grantOfferFirst: false, start: "offer", video: { ...noShort, courseStartSec: null } }),
    ).toMatchObject({ startAt: 40 });
  });
});
