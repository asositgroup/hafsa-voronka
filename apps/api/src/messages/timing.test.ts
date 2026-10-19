import { describe, expect, it } from "vitest";
import { compareTimeline, dayForTiming, isNightMinute, type TemplateTiming, timelineGroupKey, validateTiming } from "@funnel/shared";

describe("validateTiming", () => {
  it("keeps after_entry inside the chosen day", () => {
    expect(validateTiming(1, { type: "after_entry", value: 0 })).toBeNull();
    expect(validateTiming(1, { type: "after_entry", value: 1439 })).toBeNull();
    expect(validateTiming(1, { type: "after_entry", value: 1440 })).toBe("outside_day");
    expect(validateTiming(2, { type: "after_entry", value: 1439 })).toBe("outside_day");
    expect(validateTiming(2, { type: "after_entry", value: 1440 })).toBeNull();
    expect(validateTiming(7, { type: "after_entry", value: 10079 })).toBeNull();
  });

  it("rejects after_entry outside the seven days", () => {
    expect(validateTiming(1, { type: "after_entry", value: -1 })).toBe("out_of_range");
    expect(validateTiming(7, { type: "after_entry", value: 10080 })).toBe("out_of_range");
    expect(validateTiming(1, { type: "after_entry", value: 1.5 })).toBe("out_of_range");
  });

  it("blocks the night for day_time at the edges", () => {
    expect(validateTiming(1, { type: "day_time", value: 6 * 60 + 59 })).toBe("night");
    expect(validateTiming(1, { type: "day_time", value: 7 * 60 })).toBeNull();
    expect(validateTiming(1, { type: "day_time", value: 22 * 60 + 59 })).toBeNull();
    expect(validateTiming(1, { type: "day_time", value: 23 * 60 })).toBe("night");
    expect(validateTiming(1, { type: "day_time", value: 0 })).toBe("night");
  });

  it("limits day_time to a minute of the day", () => {
    expect(validateTiming(1, { type: "day_time", value: -1 })).toBe("out_of_range");
    expect(validateTiming(1, { type: "day_time", value: 1440 })).toBe("out_of_range");
  });

  it("allows before_expiry between one minute and seven days", () => {
    expect(validateTiming(3, { type: "before_expiry", value: 0 })).toBe("out_of_range");
    expect(validateTiming(3, { type: "before_expiry", value: 1 })).toBeNull();
    expect(validateTiming(3, { type: "before_expiry", value: 10080 })).toBeNull();
    expect(validateTiming(3, { type: "before_expiry", value: 10081 })).toBe("out_of_range");
  });

  it("reports night minutes", () => {
    expect(isNightMinute(419)).toBe(true);
    expect(isNightMinute(420)).toBe(false);
    expect(isNightMinute(1379)).toBe(false);
    expect(isNightMinute(1380)).toBe(true);
  });
});

describe("timeline helpers", () => {
  const entry = (day: number, timing: TemplateTiming, position = 0, id = 1) => ({ day, timing, position, id });

  it("derives the day from timing", () => {
    expect(dayForTiming({ type: "after_entry", value: 0 }, 5)).toBe(1);
    expect(dayForTiming({ type: "after_entry", value: 1439 }, 5)).toBe(1);
    expect(dayForTiming({ type: "after_entry", value: 1440 }, 1)).toBe(2);
    expect(dayForTiming({ type: "after_entry", value: 7 * 1440 - 1 }, 1)).toBe(7);
    expect(dayForTiming({ type: "day_time", value: 600 }, 4)).toBe(4);
    expect(dayForTiming({ type: "before_expiry", value: 300 }, 4)).toBe(1);
  });

  it("produces timings that validate for every derived day", () => {
    for (let value = 0; value < 7 * 1440; value += 7) {
      const timing: TemplateTiming = { type: "after_entry", value };
      expect(validateTiming(dayForTiming(timing, 1), timing)).toBeNull();
    }
    for (let day = 1; day <= 7; day++) {
      const timing: TemplateTiming = { type: "day_time", value: 7 * 60 };
      expect(validateTiming(dayForTiming(timing, day), timing)).toBeNull();
      expect(validateTiming(dayForTiming({ type: "day_time", value: 22 * 60 + 59 }, day), { type: "day_time", value: 22 * 60 + 59 })).toBeNull();
    }
    for (const value of [1, 60, 10080]) {
      const timing: TemplateTiming = { type: "before_expiry", value };
      expect(validateTiming(dayForTiming(timing, 3), timing)).toBeNull();
    }
  });

  it("groups by day and separates expiry messages", () => {
    expect(timelineGroupKey(entry(1, { type: "after_entry", value: 1500 }))).toBe(2);
    expect(timelineGroupKey(entry(3, { type: "day_time", value: 600 }))).toBe(3);
    expect(timelineGroupKey(entry(1, { type: "before_expiry", value: 60 }))).toBe("expiry");
  });

  it("sorts chronologically across timing types", () => {
    const items = [
      entry(1, { type: "day_time", value: 20 * 60 }, 0, 1),
      entry(1, { type: "after_entry", value: 30 }, 0, 2),
      entry(2, { type: "day_time", value: 9 * 60 }, 0, 3),
      entry(1, { type: "after_entry", value: 30 }, 1, 4),
    ];
    expect([...items].sort(compareTimeline).map((item) => item.id)).toEqual([2, 4, 1, 3]);
  });

  it("sorts expiry messages with more hours before first", () => {
    const early = entry(1, { type: "before_expiry", value: 1440 }, 0, 1);
    const late = entry(1, { type: "before_expiry", value: 60 }, 0, 2);
    expect([late, early].sort(compareTimeline).map((item) => item.id)).toEqual([1, 2]);
  });
});
