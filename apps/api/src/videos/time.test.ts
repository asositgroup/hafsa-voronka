import { describe, expect, it } from "vitest";
import { formatMmSs, parseMmSs, validateVideoMarks } from "@funnel/shared";

describe("formatMmSs", () => {
  it("pads and floors", () => {
    expect(formatMmSs(0)).toBe("00:00");
    expect(formatMmSs(65.9)).toBe("01:05");
    expect(formatMmSs(545)).toBe("09:05");
  });

  it("does not cap minutes", () => {
    expect(formatMmSs(4503)).toBe("75:03");
  });
});

describe("parseMmSs", () => {
  it("parses MM:SS and H:MM:SS", () => {
    expect(parseMmSs("9:05")).toBe(545);
    expect(parseMmSs(" 75:03 ")).toBe(4503);
    expect(parseMmSs("1:02:03")).toBe(3723);
    expect(parseMmSs("0:00")).toBe(0);
    expect(parseMmSs("75:30")).toBe(4530);
  });

  it("rejects malformed input", () => {
    expect(parseMmSs("5:60")).toBeNull();
    expect(parseMmSs("1:60")).toBeNull();
    expect(parseMmSs("-1:00")).toBeNull();
    expect(parseMmSs("abc")).toBeNull();
    expect(parseMmSs("")).toBeNull();
    expect(parseMmSs("12")).toBeNull();
    expect(parseMmSs("1:2:3")).toBeNull();
  });

  it("round trips", () => {
    for (const sec of [0, 59, 60, 545, 4503]) {
      expect(parseMmSs(formatMmSs(sec))).toBe(sec);
    }
  });
});

describe("validateVideoMarks", () => {
  const open = { requirePrice: false };

  it("accepts ordered marks and empty marks", () => {
    expect(validateVideoMarks({}, 900, open)).toBeNull();
    expect(validateVideoMarks({ introEndSec: 30, courseStartSec: 60, priceSec: 600 }, 900, open)).toBeNull();
  });

  it("rejects negative marks", () => {
    expect(validateVideoMarks({ introEndSec: -1 }, 900, open)).toBe("mark_negative");
  });

  it("requires price only when asked", () => {
    expect(validateVideoMarks({}, 900, { requirePrice: true })).toBe("price_required");
    expect(validateVideoMarks({ priceSec: 100 }, 900, { requirePrice: true })).toBeNull();
  });

  it("rejects price at or after duration", () => {
    expect(validateVideoMarks({ priceSec: 900 }, 900, open)).toBe("price_after_duration");
  });

  it("rejects course start at or after price", () => {
    expect(validateVideoMarks({ courseStartSec: 600, priceSec: 600 }, 900, open)).toBe("course_after_price");
  });

  it("rejects intro end at or after the next mark", () => {
    expect(validateVideoMarks({ introEndSec: 60, courseStartSec: 60 }, 900, open)).toBe("intro_after_course");
    expect(validateVideoMarks({ introEndSec: 600, priceSec: 600 }, 900, open)).toBe("intro_after_course");
    expect(validateVideoMarks({ introEndSec: 900 }, 900, open)).toBe("intro_after_course");
  });
});
