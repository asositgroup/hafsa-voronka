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
  wroteAdminAt: null,
  wroteAdminBy: null,
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

describe("renderLeadCard wrote-admin mark", () => {
  const linked: Lead = { ...webLead, userId: 5 };
  const wroteAt = new Date("2026-10-12T10:00:00Z");

  it("shows the mark with the admin who set it and the time", () => {
    const card = renderLeadCard(
      { ...linked, assigneeTelegramId: 42, assigneeName: "Sardor" },
      { ...user, wroteAdminAt: wroteAt, wroteAdminBy: 42 },
    );
    expect(card).toContain("✍️ Adminga yozdi · Sardor · 2026-10-12 15:00 (Toshkent)");
  });

  it("falls back to the telegram id for an admin who is not the assignee", () => {
    const card = renderLeadCard(linked, { ...user, wroteAdminAt: wroteAt, wroteAdminBy: 77 });
    expect(card).toContain("✍️ Adminga yozdi · ID 77 · 2026-10-12 15:00 (Toshkent)");
  });

  it("omits the who part when the user wrote on their own", () => {
    const card = renderLeadCard(linked, { ...user, wroteAdminAt: wroteAt });
    expect(card).toContain("✍️ Adminga yozdi · 2026-10-12 15:00 (Toshkent)");
  });

  it("shows nothing before the mark", () => {
    expect(renderLeadCard(linked, user)).not.toContain("Adminga yozdi");
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
    renderLeadKeyboard(lead, null).inline_keyboard.map((row) =>
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

  const linkedLead: Lead = { ...webLead, userId: 5 };
  const linkedButtons = (lead: Lead, cardUser: CardUser | null) =>
    renderLeadKeyboard(lead, cardUser).inline_keyboard.map((row) =>
      row.map((b) => `${b.text}|${"callback_data" in b ? b.callback_data : ""}`),
    );

  it("adds the wrote button for a linked lead whose user has not written to admin", () => {
    expect(linkedButtons(linkedLead, user)).toEqual([
      ["🙋 Men olaman|lead:claim:1"],
      ["✅ Muvaffaqiyatli|lead:won:1", "❌ Yo'qotildi|lead:lost:1"],
      ["✍️ Yozdi|lead:wrote:1"],
    ]);
  });

  it("keeps the wrote button after an outcome is set", () => {
    expect(linkedButtons({ ...linkedLead, assigneeTelegramId: 42, outcome: "lost" }, user)).toEqual([
      ["✍️ Yozdi|lead:wrote:1"],
    ]);
  });

  it("hides the wrote button once the user wrote to admin", () => {
    const wrote = { ...user, wroteAdminAt: new Date("2026-10-12T10:00:00Z") };
    expect(linkedButtons(linkedLead, wrote)).toEqual([
      ["🙋 Men olaman|lead:claim:1"],
      ["✅ Muvaffaqiyatli|lead:won:1", "❌ Yo'qotildi|lead:lost:1"],
    ]);
    expect(linkedButtons({ ...linkedLead, outcome: "won" }, wrote)).toEqual([]);
  });

  it("hides the wrote button for a lead without a user row", () => {
    expect(linkedButtons(webLead, null)).toEqual([
      ["🙋 Men olaman|lead:claim:1"],
      ["✅ Muvaffaqiyatli|lead:won:1", "❌ Yo'qotildi|lead:lost:1"],
    ]);
  });
});

describe("renderLeadCard second chance line", () => {
  const linked: Lead = { ...webLead, userId: 5 };

  it("shows how many second chances went out and the latest answer", () => {
    const waiting = renderLeadCard(linked, { ...user, secondChance: { offered: 2, answer: null, exhausted: false } });
    expect(waiting).toContain("🔁 Qayta imkon: 2/7 · javob kutilmoqda");
    const again = renderLeadCard(linked, { ...user, secondChance: { offered: 1, answer: "again", exhausted: false } });
    expect(again).toContain("🔁 Qayta imkon: 1/7 · «Ha» bosdi");
    const later = renderLeadCard(linked, { ...user, secondChance: { offered: 3, answer: "later", exhausted: false } });
    expect(later).toContain("🔁 Qayta imkon: 3/7 · «Keyinroq» bosdi");
    const done = renderLeadCard(linked, { ...user, secondChance: { offered: 7, answer: null, exhausted: true } });
    expect(done).toContain("🔁 Qayta imkon: 7/7 · imkon tugadi");
  });

  it("shows nothing before the first second chance", () => {
    expect(renderLeadCard(linked, { ...user, secondChance: { offered: 0, answer: null, exhausted: false } })).not.toContain(
      "Qayta imkon",
    );
  });
});
