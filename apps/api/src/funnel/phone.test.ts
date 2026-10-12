import { describe, expect, it } from "vitest";
import {
  ALLOWED_UZ_OPERATORS,
  normalizeContactPhone,
  normalizeUzPhone,
} from "@funnel/shared";

describe("normalizeUzPhone", () => {
  it("normalizes all allowed operators", () => {
    for (const op of ALLOWED_UZ_OPERATORS) {
      expect(normalizeUzPhone(`${op}1234567`)).toBe(`+998${op}1234567`);
      expect(normalizeUzPhone(`+998${op}1234567`)).toBe(`+998${op}1234567`);
      expect(normalizeUzPhone(`998${op}1234567`)).toBe(`+998${op}1234567`);
    }
  });

  it("handles different formatting with spaces, dashes, and parentheses", () => {
    expect(normalizeUzPhone("+998 90 123 45 67")).toBe("+998901234567");
    expect(normalizeUzPhone("+998-91-234-56-78")).toBe("+998912345678");
    expect(normalizeUzPhone("+998 (93) 345-67-89")).toBe("+998933456789");
    expect(normalizeUzPhone("998 (94) 123 45 67")).toBe("+998941234567");
    expect(normalizeUzPhone("(95) 123-4567")).toBe("+998951234567");
    expect(normalizeUzPhone("97-123-45-67")).toBe("+998971234567");
  });

  it("rejects invalid operator codes", () => {
    expect(normalizeUzPhone("921234567")).toBeNull();
    expect(normalizeUzPhone("121234567")).toBeNull();
    expect(normalizeUzPhone("+998201234567")).toBeNull();
    expect(normalizeUzPhone("998001234567")).toBeNull();
  });

  it("rejects numbers with invalid lengths", () => {
    expect(normalizeUzPhone("90123456")).toBeNull();
    expect(normalizeUzPhone("9012345678")).toBeNull();
    expect(normalizeUzPhone("+99890123456")).toBeNull();
    expect(normalizeUzPhone("+9989012345678")).toBeNull();
    expect(normalizeUzPhone("")).toBeNull();
  });

  it("rejects numbers with non-formatting characters", () => {
    expect(normalizeUzPhone("90 123 ab 45")).toBeNull();
    expect(normalizeUzPhone("+998 90 123#45")).toBeNull();
    expect(normalizeUzPhone("abc")).toBeNull();
  });

  it("rejects non-Uzbek phone numbers", () => {
    expect(normalizeUzPhone("+14155552671")).toBeNull();
    expect(normalizeUzPhone("+79991234567")).toBeNull();
  });
});

describe("normalizeContactPhone", () => {
  it("adds plus to raw digit strings", () => {
    expect(normalizeContactPhone("998901234567")).toBe("+998901234567");
    expect(normalizeContactPhone("14155552671")).toBe("+14155552671");
  });

  it("preserves leading plus and strips formatting", () => {
    expect(normalizeContactPhone("+998901234567")).toBe("+998901234567");
    expect(normalizeContactPhone("+1 (415) 555-2671")).toBe("+14155552671");
  });

  it("handles empty string", () => {
    expect(normalizeContactPhone("")).toBe("");
  });
});
