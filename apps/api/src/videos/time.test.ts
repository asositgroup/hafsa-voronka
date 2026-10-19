import { describe, expect, it } from "vitest";
import { defaultLessonStartSec, formatMmSs, parseMmSs, validateVideoMarks } from "@funnel/shared";

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

  it("accepts an unlock point strictly inside the video regardless of other marks", () => {
    expect(validateVideoMarks({ unlockSec: 10, courseStartSec: 60, priceSec: 600 }, 900, open)).toBeNull();
    expect(validateVideoMarks({ unlockSec: 800, priceSec: 600 }, 900, open)).toBeNull();
  });

  it("rejects an unlock point at zero or at or after the duration", () => {
    expect(validateVideoMarks({ unlockSec: 0 }, 900, open)).toBe("unlock_out_of_range");
    expect(validateVideoMarks({ unlockSec: 900 }, 900, open)).toBe("unlock_out_of_range");
    expect(validateVideoMarks({ unlockSec: -1 }, 900, open)).toBe("mark_negative");
  });

  it("rejects intro end at or after the next mark", () => {
    expect(validateVideoMarks({ introEndSec: 60, courseStartSec: 60 }, 900, open)).toBe("intro_after_course");
    expect(validateVideoMarks({ introEndSec: 600, priceSec: 600 }, 900, open)).toBe("intro_after_course");
    expect(validateVideoMarks({ introEndSec: 900 }, 900, open)).toBe("intro_after_course");
  });
});

describe("defaultLessonStartSec", () => {
  it("is 5:00 unless the course part starts earlier", () => {
    expect(defaultLessonStartSec({ courseStartSec: 900, priceSec: 1102 }, 1500)).toBe(300);
    expect(defaultLessonStartSec({ courseStartSec: 240, priceSec: 600 }, 900)).toBe(239);
    expect(defaultLessonStartSec({ courseStartSec: null, priceSec: 200 }, 900)).toBe(199);
    expect(defaultLessonStartSec({ courseStartSec: null, priceSec: null }, 120)).toBe(119);
  });

  it("always passes the marks check", () => {
    const open = { requirePrice: false };
    expect(validateVideoMarks({ introEndSec: defaultLessonStartSec({ courseStartSec: 1, priceSec: 5 }, 9), courseStartSec: 1, priceSec: 5 }, 9, open)).toBeNull();
  });
});
