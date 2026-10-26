import { describe, expect, it } from "vitest";
import { compareTimeline, defaultMinute, isNightMinute, isSameMoment, validateTiming } from "@funnel/shared";

describe("validateTiming", () => {
  it("accepts any minute of the day on every day", () => {
    expect(validateTiming(1, 0)).toBeNull();
    expect(validateTiming(1, 1439)).toBeNull();
    expect(validateTiming(3, 30)).toBeNull();
    expect(validateTiming(7, 1439)).toBeNull();
  });

  it("rejects minutes outside the day and fractions", () => {
    expect(validateTiming(1, 1440)).toBe("out_of_range");
    expect(validateTiming(2, -1)).toBe("out_of_range");
    expect(validateTiming(2, 1.5)).toBe("out_of_range");
  });

  it("reports night minutes", () => {
    expect(isNightMinute(419)).toBe(true);
    expect(isNightMinute(420)).toBe(false);
    expect(isNightMinute(1379)).toBe(false);
    expect(isNightMinute(1380)).toBe(true);
  });
});

describe("timeline helpers", () => {
  it("defaults day 1 to an hour after entry and other days to 10:00", () => {
    expect(defaultMinute(1)).toBe(60);
    expect(defaultMinute(4)).toBe(600);
  });

  it("sorts by day, minute, position and id", () => {
    const items = [
      { day: 2, minute: 600, position: 1, id: 9 },
      { day: 1, minute: 900, position: 0, id: 3 },
      { day: 2, minute: 600, position: 0, id: 12 },
    ];
    expect([...items].sort(compareTimeline).map((item) => item.id)).toEqual([3, 12, 9]);
  });

  it("treats the same day and minute as the same moment", () => {
    expect(isSameMoment({ day: 2, minute: 600 }, { day: 2, minute: 600 })).toBe(true);
    expect(isSameMoment({ day: 2, minute: 600 }, { day: 3, minute: 600 })).toBe(false);
    expect(isSameMoment({ day: 2, minute: 600 }, { day: 2, minute: 601 })).toBe(false);
  });
});
