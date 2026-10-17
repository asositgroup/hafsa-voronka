import { beforeAll, describe, expect, it } from "vitest";
import type { Lead } from "@/db/schema";
import { setTestEnv } from "@/test/env";
import { leadSheetHeaders, renderLeadRow, type SheetUser } from "./sheet";

const lead: Lead = {
  id: 42,
  source: "web",
  userId: null,
  visitorId: "AbCdEfGhIj",
  name: "Aziz Karimov",
  phone: "+998901234567",
  utmSource: "facebook",
  utmCampaign: "autumn_sale",
  utmContent: null,
  fbclid: null,
  pageUrl: null,
  userAgent: null,
  createdAt: new Date("2026-10-12T09:32:00Z"),
  linkedAt: null,
  formSubmittedAt: new Date("2026-10-12T09:32:00Z"),
  notifyVersion: 1,
  notifiedVersion: 0,
  notifyMessageId: null,
  notifyAttempts: 0,
  notifyError: null,
  completionNotified: false,
  sheetsSyncedVersion: 0,
  sheetsAttempts: 0,
  sheetsError: null,
  assigneeTelegramId: null,
  assigneeName: null,
  assigneeUsername: null,
  assignedAt: null,
  outcome: null,
  outcomeAt: null,
};

const user: SheetUser = {
  telegramId: 123456789,
  username: "aziz_k",
  phone: "+998935554433",
  phoneVerified: true,
  registeredAt: new Date("2026-10-12T09:35:00Z"),
  completedAt: null,
};

const cell = (row: unknown[], header: string) => row[leadSheetHeaders.indexOf(header)];

describe("renderLeadRow", () => {
  beforeAll(() => {
    setTestEnv({ VIDEO_DURATION_SEC: "600" });
  });

  it("renders a form-only lead with empty Telegram columns", () => {
    expect(renderLeadRow(lead, null, null)).toEqual([
      42,
      "2026-10-12 14:32",
      "sayt",
      "Aziz Karimov",
      "'+998901234567",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "facebook",
      "autumn_sale",
      "",
    ]);
  });

  it("merges form and bot data into one row", () => {
    const row = renderLeadRow({ ...lead, userId: 5 }, user, 300);
    expect(cell(row, "Manba")).toBe("sayt → bot");
    expect(cell(row, "Telefon (forma)")).toBe("'+998901234567");
    expect(cell(row, "Telegram raqami")).toBe("'+998935554433");
    expect(cell(row, "Raqam tasdiqlangan")).toBe(true);
    expect(cell(row, "Telegram")).toBe("@aziz_k");
    expect(cell(row, "Telegram ID")).toBe("123456789");
    expect(cell(row, "Botga kirdi")).toBe("2026-10-12 14:35");
    expect(cell(row, "Video %")).toBe("50%");
  });

  it("labels a bot lead that filled the form later", () => {
    const botFirst = { ...lead, source: "bot" as const, formSubmittedAt: new Date("2026-10-12T10:00:00Z") };
    expect(cell(renderLeadRow(botFirst, user, 0), "Manba")).toBe("bot → sayt");
  });

  it("leaves the form phone empty for a bot-only lead", () => {
    const row = renderLeadRow({ ...lead, source: "bot", formSubmittedAt: null }, user, 0);
    expect(cell(row, "Manba")).toBe("bot");
    expect(cell(row, "Telefon (forma)")).toBe("");
  });

  it("shows completion, assignee and outcome", () => {
    const row = renderLeadRow(
      { ...lead, assigneeTelegramId: 7, assigneeName: "Sardor", assigneeUsername: "sardor_s", outcome: "won" },
      { ...user, completedAt: new Date("2026-10-12T10:00:00Z") },
      600,
    );
    expect(cell(row, "Video %")).toBe("100%");
    expect(cell(row, "Video tugadi")).toBe("2026-10-12 15:00");
    expect(cell(row, "Mas'ul")).toBe("Sardor (@sardor_s)");
    expect(cell(row, "Natija")).toBe("✅ Muvaffaqiyatli");
  });
});
