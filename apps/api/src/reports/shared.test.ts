import { describe, expect, it } from "vitest";
import { plainTextPreview, reportPercent } from "@funnel/shared";

describe("reportPercent", () => {
  it("passes null through", () => {
    expect(reportPercent(null, 10)).toBeNull();
  });

  it("returns 0 when the base is 0", () => {
    expect(reportPercent(0, 0)).toBe(0);
    expect(reportPercent(5, 0)).toBe(0);
  });

  it("rounds to one decimal place", () => {
    expect(reportPercent(5, 6)).toBe(83.3);
    expect(reportPercent(1, 3)).toBe(33.3);
    expect(reportPercent(2, 3)).toBe(66.7);
    expect(reportPercent(3, 3)).toBe(100);
  });
});

describe("plainTextPreview", () => {
  it("strips tags", () => {
    expect(plainTextPreview("Salom, <b>dunyo</b> <a href=\"https://x.uz\">havola</a>")).toBe("Salom, dunyo havola");
  });

  it("decodes entities", () => {
    expect(plainTextPreview("A &amp; B &lt;3")).toBe("A & B <3");
  });

  it("collapses whitespace", () => {
    expect(plainTextPreview("bir\n\n  ikki   uch")).toBe("bir ikki uch");
  });

  it("truncates with an ellipsis", () => {
    const preview = plainTextPreview("x".repeat(100), 10);
    expect(preview).toBe(`${"x".repeat(9)}…`);
    expect(preview.length).toBe(10);
  });

  it("keeps short text untouched", () => {
    expect(plainTextPreview("qisqa", 10)).toBe("qisqa");
  });
});
