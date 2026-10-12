import { describe, expect, it } from "vitest";
import { formatLeadRow, formatTashkentDate } from "./sheets";
import type { User } from "./db/schema";

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

describe("formatLeadRow", () => {
  const baseUser: User = {
    id: 1,
    telegramId: 123456789,
    username: "john_doe",
    firstName: "John",
    languageCode: "uz",
    name: "John Doe",
    phone: "+998901234567",
    phoneVerified: true,
    startParam: "v_vis123",
    visitorId: "vis123",
    utmSource: "telegram",
    utmCampaign: "autumn",
    utmContent: "ad1",
    fbclid: null,
    registeredAt: new Date("2026-10-12T05:00:00Z"),
    completedAt: null,
    channelClickAt: null,
    botBlocked: false,
    createdAt: new Date("2026-10-12T04:00:00Z"),
  };

  it("formats lead row with apostrophe-prefixed phone and Tashkent date", () => {
    const row = formatLeadRow(baseUser, new Date("2026-10-12T05:00:00Z"));
    expect(row).toEqual([
      "2026-10-12 10:00",
      "John Doe",
      "'+998901234567",
      true,
      "@john_doe",
      "123456789",
      "telegram",
      "autumn",
      "ad1",
      "bot",
    ]);
  });

  it("does not double-prefix phone if already prefixed", () => {
    const row = formatLeadRow({
      ...baseUser,
      phone: "'+998901234567",
    });
    expect(row[2]).toBe("'+998901234567");
  });

  it("handles missing username and missing UTM fields", () => {
    const row = formatLeadRow({
      ...baseUser,
      username: null,
      utmSource: null,
      utmCampaign: null,
      utmContent: null,
    });
    expect(row[4]).toBe("");
    expect(row[6]).toBe("");
    expect(row[7]).toBe("");
    expect(row[8]).toBe("");
  });

  it("preserves username that already starts with @", () => {
    const row = formatLeadRow({
      ...baseUser,
      username: "@prefixed",
    });
    expect(row[4]).toBe("@prefixed");
  });
});
