import { describe, expect, it } from "vitest";
import { isNightMinute, validateTiming } from "@funnel/shared";

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
