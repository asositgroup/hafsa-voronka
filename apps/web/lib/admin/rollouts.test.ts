import { describe, expect, it } from "vitest";
import { formatCount, formatTashkentShort, rolloutFailureMessage, tashkentToIso } from "./rollouts";

describe("formatCount", () => {
  it("separates thousands with spaces", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1243)).toBe("1 243");
    expect(formatCount(1234567)).toBe("1 234 567");
  });
});

describe("tashkentToIso", () => {
  it("builds an offset timestamp for the Tashkent wall clock", () => {
    const iso = tashkentToIso("2026-10-25", 10 * 60 + 5);
    expect(iso).toBe("2026-10-25T10:05:00+05:00");
    expect(new Date(iso).toISOString()).toBe("2026-10-25T05:05:00.000Z");
  });
});

describe("formatTashkentShort", () => {
  it("renders day, month and time in Tashkent", () => {
    expect(formatTashkentShort("2026-10-25T05:00:00.000Z")).toBe("25.10 10:00");
    expect(formatTashkentShort("2026-10-24T20:30:00.000Z")).toBe("25.10 01:30");
  });
});

describe("rolloutFailureMessage", () => {
  it("falls back to the generic message", () => {
    expect(rolloutFailureMessage("nope")).toBe(rolloutFailureMessage(undefined));
    expect(rolloutFailureMessage("past")).not.toBe(rolloutFailureMessage(undefined));
  });
});
