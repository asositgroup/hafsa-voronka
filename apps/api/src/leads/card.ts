import { InlineKeyboard } from "grammy";
import { type OfferAnswer, SECOND_CHANCE_OCCASIONS } from "@funnel/shared";
import type { Lead, User } from "@/db/schema";
import { formatTashkentDate } from "@/sheets";

export type CardUser = Pick<
  User,
  "telegramId" | "username" | "phone" | "phoneVerified" | "registeredAt" | "completedAt" | "wroteAdminAt" | "wroteAdminBy"
> & { watchedPercent?: number; secondChance?: SecondChanceSummary };

export type SecondChanceSummary = {
  offered: number;
  answer: OfferAnswer | null;
  exhausted: boolean;
  appointmentAt?: Date | null;
};

const PROGRESS_CELLS = 10;

export function watchedPercent(maxPosition: number, duration: number) {
  if (duration <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((maxPosition / duration) * 100)));
}

function progressLine(percent: number | undefined) {
  if (!percent) return "▶️ Video: hali ko'rilmagan";
  const filled = Math.round((percent / 100) * PROGRESS_CELLS);
  return `▶️ Video: ${"▓".repeat(filled)}${"░".repeat(PROGRESS_CELLS - filled)} ${percent}%`;
}

function tashkent(date: Date) {
  return `${formatTashkentDate(date)} (Toshkent)`;
}

function utmLine(lead: Lead) {
  const parts = [lead.utmSource, lead.utmCampaign, lead.utmContent].filter(Boolean);
  return parts.length > 0 ? `🎯 UTM: ${parts.join(" / ")}` : undefined;
}

function telegramLine(user: CardUser) {
  const handle = user.username ? `@${user.username.replace(/^@/, "")}` : "username yo'q";
  return `💬 ${handle} · ID ${user.telegramId}`;
}

function secondChanceLine({ offered, answer, exhausted }: SecondChanceSummary) {
  if (offered === 0) return undefined;
  const state = exhausted
    ? "imkon tugadi"
    : answer === "again"
      ? "«Ha» bosdi"
      : answer === "later"
        ? "«Keyinroq» bosdi"
        : "javob kutilmoqda";
  return `🔁 Qayta imkon: ${offered}/${SECOND_CHANCE_OCCASIONS} · ${state}`;
}

function wroteAdminLine(lead: Lead, at: Date, by: number | null) {
  const parts = ["✍️ Adminga yozdi"];
  if (by !== null) parts.push(by === lead.assigneeTelegramId ? assigneeLabel(lead) : `ID ${by}`);
  parts.push(tashkent(at));
  return parts.join(" · ");
}

export function renderLeadCard(lead: Lead, user: CardUser | null | undefined): string {
  const registered = user?.registeredAt ? user : undefined;
  const lines: string[] = [];

  if (lead.source === "bot") {
    lines.push("🆕 Yangi lid (bot)");
  } else if (registered) {
    lines.push("✅ Lid botda ro'yxatdan o'tdi");
  } else {
    lines.push("🆕 Yangi lid (sayt)");
  }

  lines.push(`👤 ${lead.name}`);

  const verified = registered?.phoneVerified && registered.phone === lead.phone;
  lines.push(`📞 ${lead.phone}${verified ? " (tasdiqlangan)" : ""}`);
  if (registered?.phone && registered.phone !== lead.phone) {
    const note = registered.phoneVerified ? " (tasdiqlangan)" : "";
    lines.push(`📱 Telegram raqami: ${registered.phone}${note}`);
  }

  if (registered) lines.push(telegramLine(registered));

  if (lead.formSubmittedAt && registered?.registeredAt) {
    lines.push(`📅 Sayt: ${tashkent(lead.formSubmittedAt)}`);
    lines.push(`📅 Bot: ${tashkent(registered.registeredAt)}`);
  } else {
    lines.push(`📅 ${tashkent(registered?.registeredAt ?? lead.createdAt)}`);
  }

  const utm = utmLine(lead);
  if (utm) lines.push(utm);

  if (lead.source === "web" && !registered) lines.push("🔗 Telegram: hali botga kirmagan");
  if (registered?.completedAt) lines.push("🎬 Videoni ko'rib bo'ldi");
  else if (registered) lines.push(progressLine(registered.watchedPercent));

  const secondChance = registered?.secondChance && secondChanceLine(registered.secondChance);
  if (secondChance) lines.push(secondChance);
  if (registered?.secondChance?.appointmentAt) {
    lines.push(`⏰ Tanlangan vaqt: ${tashkent(registered.secondChance.appointmentAt)}`);
  }

  if (user?.wroteAdminAt) lines.push(wroteAdminLine(lead, user.wroteAdminAt, user.wroteAdminBy));
  if (lead.assigneeTelegramId !== null) lines.push(`👨‍💼 Mas'ul: ${assigneeLabel(lead)}`);
  if (lead.outcome) lines.push(`🏁 Natija: ${outcomeLabels[lead.outcome]}`);

  return lines.join("\n");
}

export type LeadAction = "claim" | "won" | "lost" | "wrote";

export const outcomeLabels = {
  won: "✅ Muvaffaqiyatli",
  lost: "❌ Yo'qotildi",
} as const;

export function assigneeLabel(lead: Pick<Lead, "assigneeName" | "assigneeUsername">) {
  const name = lead.assigneeName || "Sotuvchi";
  return lead.assigneeUsername ? `${name} (@${lead.assigneeUsername})` : name;
}

export function leadActionData(action: LeadAction, leadId: number) {
  return `lead:${action}:${leadId}`;
}

export function renderLeadKeyboard(
  lead: Lead,
  user: Pick<CardUser, "wroteAdminAt"> | null | undefined,
): InlineKeyboard {
  const rows: { text: string; data: string }[][] = [];
  if (!lead.outcome) {
    const claimText =
      lead.assigneeTelegramId === null ? "🙋 Men olaman" : `👤 ${lead.assigneeName || "Biriktirilgan"}`;
    rows.push([{ text: claimText, data: leadActionData("claim", lead.id) }]);
    rows.push([
      { text: outcomeLabels.won, data: leadActionData("won", lead.id) },
      { text: outcomeLabels.lost, data: leadActionData("lost", lead.id) },
    ]);
  }
  if (lead.userId !== null && user && user.wroteAdminAt === null) {
    rows.push([{ text: "✍️ Yozdi", data: leadActionData("wrote", lead.id) }]);
  }
  return new InlineKeyboard(rows.map((row) => row.map(({ text, data }) => InlineKeyboard.text(text, data))));
}

export function renderCompletionReply(lead: Lead): string {
  return `🎬 ${lead.name} videoni oxirigacha ko'rdi`;
}
