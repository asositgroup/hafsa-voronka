import { describe, expect, it } from "vitest";
import type { Lead } from "@/db/schema";
import {
  renderCompletionReply,
  renderLeadCard,
  renderLeadKeyboard,
  watchedPercent,
  type CardUser,
} from "./card";

const webLead: Lead = {
  id: 1,
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

const user: CardUser = {
  telegramId: 123456789,
  username: "aziz_k",
  phone: "+998901234567",
  phoneVerified: true,
  registeredAt: new Date("2026-10-12T09:35:00Z"),
  completedAt: null,
};

describe("renderLeadCard", () => {
  it("renders a fresh web lead waiting for Telegram", () => {
    expect(renderLeadCard(webLead, null)).toBe(
      [
        "🆕 Yangi lid (sayt)",
        "👤 Aziz Karimov",
        "📞 +998901234567",
        "📅 2026-10-12 14:32 (Toshkent)",
        "🎯 UTM: facebook / autumn_sale",
        "🔗 Telegram: hali botga kirmagan",
      ].join("\n"),
    );
  });

  it("renders a web lead after the user registers in the bot", () => {
    expect(renderLeadCard({ ...webLead, userId: 5 }, user)).toBe(
      [
        "✅ Lid botda ro'yxatdan o'tdi",
        "👤 Aziz Karimov",
        "📞 +998901234567 (tasdiqlangan)",
        "💬 @aziz_k · ID 123456789",
        "📅 Sayt: 2026-10-12 14:32 (Toshkent)",
        "📅 Bot: 2026-10-12 14:35 (Toshkent)",
        "🎯 UTM: facebook / autumn_sale",
        "▶️ Video: hali ko'rilmagan",
      ].join("\n"),
    );
  });

  it("shows partial watch progress as a bar", () => {
    const card = renderLeadCard({ ...webLead, userId: 5 }, { ...user, watchedPercent: 52 });
    expect(card).toContain("▶️ Video: ▓▓▓▓▓░░░░░ 52%");
  });

  it("shows the Telegram phone separately when it differs from the form", () => {
    const card = renderLeadCard(webLead, { ...user, phone: "+998935554433", username: null });
    expect(card).toContain("📞 +998901234567\n");
    expect(card).toContain("📱 Telegram raqami: +998935554433 (tasdiqlangan)");
    expect(card).toContain("💬 username yo'q · ID 123456789");
  });

  it("renders a bot-only lead and the finished-video line", () => {
    const card = renderLeadCard(
      { ...webLead, source: "bot", formSubmittedAt: null, utmSource: null, utmCampaign: null },
      { ...user, completedAt: new Date() },
    );
    expect(card.split("\n")).toEqual([
      "🆕 Yangi lid (bot)",
      "👤 Aziz Karimov",
      "📞 +998901234567 (tasdiqlangan)",
      "💬 @aziz_k · ID 123456789",
      "📅 2026-10-12 14:35 (Toshkent)",
      "🎬 Videoni ko'rib bo'ldi",
    ]);
  });

  it("renders the completion reply", () => {
    expect(renderCompletionReply(webLead)).toBe("🎬 Aziz Karimov videoni oxirigacha ko'rdi");
  });

  it("shows the assignee and the outcome", () => {
    const card = renderLeadCard(
      { ...webLead, assigneeTelegramId: 42, assigneeName: "Sardor", assigneeUsername: "sardor_s", outcome: "won" },
      null,
    );
    expect(card.split("\n").slice(-2)).toEqual(["👨‍💼 Mas'ul: Sardor (@sardor_s)", "🏁 Natija: ✅ Muvaffaqiyatli"]);
  });
});

describe("watchedPercent", () => {
  it("rounds and clamps to 0..100", () => {
    expect(watchedPercent(150, 600)).toBe(25);
    expect(watchedPercent(700, 600)).toBe(100);
    expect(watchedPercent(10, 0)).toBe(0);
  });
});

describe("renderLeadKeyboard", () => {
  const buttons = (lead: Lead) =>
    renderLeadKeyboard(lead).inline_keyboard.map((row) =>
      row.map((b) => `${b.text}|${"callback_data" in b ? b.callback_data : ""}`),
    );

  it("offers claim, won and lost on an open lead", () => {
    expect(buttons(webLead)).toEqual([
      ["🙋 Men olaman|lead:claim:1"],
      ["✅ Muvaffaqiyatli|lead:won:1", "❌ Yo'qotildi|lead:lost:1"],
    ]);
  });

  it("shows who claimed the lead on the first button", () => {
    expect(buttons({ ...webLead, assigneeTelegramId: 42, assigneeName: "Sardor" })[0]).toEqual([
      "👤 Sardor|lead:claim:1",
    ]);
  });

  it("removes the buttons once an outcome is set", () => {
    expect(buttons({ ...webLead, assigneeTelegramId: 42, outcome: "lost" })).toEqual([]);
  });
});
