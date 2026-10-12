import type { Lead, User } from "@/db/schema";
import { formatTashkentDate } from "@/sheets";

export type CardUser = Pick<
  User,
  "telegramId" | "username" | "phone" | "phoneVerified" | "registeredAt" | "completedAt"
>;

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

  if (lead.source === "web" && registered?.registeredAt) {
    lines.push(`📅 Sayt: ${tashkent(lead.createdAt)}`);
    lines.push(`📅 Bot: ${tashkent(registered.registeredAt)}`);
  } else {
    lines.push(`📅 ${tashkent(registered?.registeredAt ?? lead.createdAt)}`);
  }

  const utm = utmLine(lead);
  if (utm) lines.push(utm);

  if (lead.source === "web" && !registered) lines.push("🔗 Telegram: hali botga kirmagan");
  if (registered?.completedAt) lines.push("🎬 Videoni ko'rib bo'ldi");

  return lines.join("\n");
}

export function renderCompletionReply(lead: Lead): string {
  return `🎬 ${lead.name} videoni oxirigacha ko'rdi`;
}
