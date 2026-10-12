import { describe, expect, it } from "vitest";
import type { Lead } from "@/db/schema";
import { renderCompletionReply, renderLeadCard, type CardUser } from "./card";

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
  notifyVersion: 1,
  notifiedVersion: 0,
  notifyMessageId: null,
  notifyAttempts: 0,
  notifyError: null,
  completionNotified: false,
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
      ].join("\n"),
    );
  });

  it("shows the Telegram phone separately when it differs from the form", () => {
    const card = renderLeadCard(webLead, { ...user, phone: "+998935554433", username: null });
    expect(card).toContain("📞 +998901234567\n");
    expect(card).toContain("📱 Telegram raqami: +998935554433 (tasdiqlangan)");
    expect(card).toContain("💬 username yo'q · ID 123456789");
  });

  it("renders a bot-only lead and the finished-video line", () => {
    const card = renderLeadCard(
      { ...webLead, source: "bot", utmSource: null, utmCampaign: null },
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
});
