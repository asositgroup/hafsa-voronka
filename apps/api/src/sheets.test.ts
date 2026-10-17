import { afterEach, describe, expect, it, vi } from "vitest";
import { appendRows, formatTashkentDate, sheetPhone } from "./sheets";
import { setTestEnv } from "./test/env";

vi.mock("google-auth-library", () => ({
  JWT: class {
    async getRequestHeaders() {
      return new Headers({ authorization: "Bearer test-token" });
    }
  },
}));

describe("formatTashkentDate", () => {
  it("formats date in Asia/Tashkent timezone", () => {
    const utcDate = new Date("2026-10-12T05:54:00Z");
    expect(formatTashkentDate(utcDate)).toBe("2026-10-12 10:54");
  });

  it("handles date rolling over to the next day in Tashkent", () => {
    const eveningUtc = new Date("2026-01-01T20:30:00Z");
    expect(formatTashkentDate(eveningUtc)).toBe("2026-01-02 01:30");
  });
});

describe("sheetPhone", () => {
  it("prefixes once so Sheets keeps the plus sign", () => {
    expect(sheetPhone("+998901234567")).toBe("'+998901234567");
    expect(sheetPhone("'+998901234567")).toBe("'+998901234567");
    expect(sheetPhone(null)).toBe("");
  });
});

describe("appendRows", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the service account authorization header", async () => {
    setTestEnv({ SHEET_ID: "sheet-123" });
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await appendRows("Leads!A:Q", [["row"]]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/sheet-123/values/Leads!A%3AQ:append");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("content-type")).toBe("application/json");
  });
});
