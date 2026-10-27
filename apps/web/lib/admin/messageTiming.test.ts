import { describe, expect, it } from "vitest";
import { defaultMinuteFor, timelineLabel, timingMode } from "./messageTiming";

const reminder = { kind: "reminder", atExpiry: false } as const;

describe("timingMode", () => {
  it("keeps A/B reminders relative on every day", () => {
    expect(timingMode({ ...reminder, segment: "A", day: 1 })).toBe("relative");
    expect(timingMode({ ...reminder, segment: "B", day: 5 })).toBe("relative");
  });

  it("uses clock time for stage C after day 1", () => {
    expect(timingMode({ ...reminder, segment: "C", day: 1 })).toBe("relative");
    expect(timingMode({ ...reminder, segment: "C", day: 2 })).toBe("clock");
  });

  it("lets a trigger fire at expiry or at a clock time", () => {
    expect(timingMode({ segment: "A", day: 2, kind: "trigger", atExpiry: true })).toBe("expiry");
    expect(timingMode({ segment: "B", day: 3, kind: "trigger", atExpiry: false })).toBe("clock");
  });
});

describe("defaults and labels", () => {
  it("starts relative timings at one hour and clock timings at 10:00", () => {
    expect(defaultMinuteFor({ ...reminder, segment: "A", day: 4 })).toBe(60);
    expect(defaultMinuteFor({ ...reminder, segment: "C", day: 4 })).toBe(600);
    expect(defaultMinuteFor({ segment: "A", day: 2, kind: "trigger", atExpiry: false })).toBe(600);
  });

  it("labels a day-3 A/B reminder as an offset", () => {
    expect(timelineLabel({ ...reminder, segment: "B", day: 3, minute: 90 })).toBe("+1 soat 30 daqiqa");
    expect(timelineLabel({ ...reminder, segment: "C", day: 3, minute: 570 })).toBe("09:30");
  });
});
